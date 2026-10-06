import { randomUUID } from 'node:crypto'
import type {
  ChatPermissionRequest,
  ChatPermissionResolvedEvent,
  PermissionDecisionView,
  PermissionMode
} from '@shared/ipc/chat'
import { describeRequest, ruleFor, ruleMatches } from '../../domain/conversation/permissions'
import { AppError } from '../../domain/errors'
import type { PermissionRepository } from '../../infrastructure/db/repositories/PermissionRepository'

/** Réponse attendue par Claude Code de l'outil `--permission-prompt-tool` (spec 014 R1). */
export type PermissionAnswer =
  | { readonly behavior: 'allow'; readonly updatedInput: Readonly<Record<string, unknown>> }
  | { readonly behavior: 'deny'; readonly message: string }

export type PermissionEvent =
  | { readonly type: 'chat:permission'; readonly payload: ChatPermissionRequest }
  | { readonly type: 'chat:permissionResolved'; readonly payload: ChatPermissionResolvedEvent }

export interface PermissionDeps {
  readonly repository: Pick<PermissionRepository, 'rules' | 'addRule' | 'log'>
  /** Clé du projet d'une conversation (dossier lié, sinon espace de travail du profil). */
  readonly projectKeyOf: (neuronId: string) => string
  readonly emit: (event: PermissionEvent) => void
  readonly now?: () => Date
  /** Durée maximale d'attente d'une réponse (le relais attend un peu plus). */
  readonly timeoutMs?: number
}

/** Une demande reste au plus 30 minutes sans réponse, puis elle est refusée. */
export const PERMISSION_TIMEOUT_MS = 30 * 60_000

const DENIED = 'mentalyas a refusé cette action. Ne la relance pas sans qu’il te le demande.'
const EXPIRED = 'Demande restée sans réponse (chat fermé ou conversation arrêtée) : refusée.'

interface Pending {
  readonly request: ChatPermissionRequest
  readonly input: Readonly<Record<string, unknown>>
  readonly resolve: (answer: PermissionAnswer) => void
  readonly timer: ReturnType<typeof setTimeout>
}

/**
 * Demandes de permission de Claude Code relayées dans le chat (spec 014 US1) : une règle « Toujours » de mentalyas
 * répond aussitôt ; sinon la demande attend sa réponse. Sans réponse (chat fermé, arrêt, délai), elle est refusée —
 * jamais l'app ne répond à la place de mentalyas (constitution I).
 */
export class PermissionService {
  private readonly pending = new Map<string, Pending>()

  constructor(private readonly deps: PermissionDeps) {}

  request(neuronId: string, tool: string, input: Readonly<Record<string, unknown>>): Promise<PermissionAnswer> {
    const rules = this.deps.repository.rules(this.deps.projectKeyOf(neuronId))
    if (rules.some((rule) => ruleMatches(rule, tool, input))) {
      this.deps.repository.log(neuronId, tool, 'rule')
      return Promise.resolve({ behavior: 'allow', updatedInput: input })
    }
    const request: ChatPermissionRequest = {
      id: randomUUID(),
      neuronId,
      tool,
      detail: describeRequest(tool, input),
      at: (this.deps.now?.() ?? new Date()).toISOString()
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => this.expire(request.id), this.deps.timeoutMs ?? PERMISSION_TIMEOUT_MS)
      this.pending.set(request.id, { request, input, resolve, timer })
      this.deps.emit({ type: 'chat:permission', payload: request })
    })
  }

  /** Réponse de mentalyas ; « Toujours » ajoute une règle pour le projet de la conversation. */
  decide(requestId: string, decision: PermissionDecisionView): void {
    const entry = this.pending.get(requestId)
    if (entry === undefined) throw new AppError('NOT_FOUND', 'Cette demande n’attend plus de réponse.')
    const { request, input } = entry
    if (decision === 'always') {
      this.deps.repository.addRule(this.deps.projectKeyOf(request.neuronId), ruleFor(request.tool, input))
    }
    this.settle(
      entry,
      decision,
      decision === 'deny' ? { behavior: 'deny', message: DENIED } : { behavior: 'allow', updatedInput: input }
    )
  }

  /** Demandes encore ouvertes d'une conversation (rouvrir le chat les remontre). */
  open(neuronId: string): ChatPermissionRequest[] {
    return [...this.pending.values()]
      .filter((entry) => entry.request.neuronId === neuronId)
      .map((entry) => entry.request)
  }

  /** Chat fermé ou conversation arrêtée : ses demandes ouvertes sont refusées. */
  cancel(neuronId: string): void {
    for (const entry of [...this.pending.values()]) {
      if (entry.request.neuronId === neuronId) this.settle(entry, 'expired', { behavior: 'deny', message: EXPIRED })
    }
  }

  /** Changement de mode d'une conversation, tracé comme une décision (spec 014 FR-014). */
  modeChanged(neuronId: string, mode: PermissionMode): void {
    this.deps.repository.log(neuronId, mode, 'mode')
  }

  /** Fermeture de l'app : tout ce qui attend est refusé. */
  cancelAll(): void {
    for (const entry of [...this.pending.values()])
      this.settle(entry, 'expired', { behavior: 'deny', message: EXPIRED })
  }

  private expire(requestId: string): void {
    const entry = this.pending.get(requestId)
    if (entry !== undefined) this.settle(entry, 'expired', { behavior: 'deny', message: EXPIRED })
  }

  private settle(entry: Pending, decision: ChatPermissionResolvedEvent['decision'], answer: PermissionAnswer): void {
    clearTimeout(entry.timer)
    this.pending.delete(entry.request.id)
    this.deps.repository.log(entry.request.neuronId, entry.request.tool, decision)
    entry.resolve(answer)
    this.deps.emit({
      type: 'chat:permissionResolved',
      payload: { neuronId: entry.request.neuronId, requestId: entry.request.id, decision }
    })
  }
}
