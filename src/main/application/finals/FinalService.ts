import { randomUUID } from 'node:crypto'
import { AppError } from '../../domain/errors'
import { nextFinalState, type FinalCommand, type FinalState } from '../../domain/finals/state'
import type { FinalActionRow, FinalRepository } from '../../infrastructure/db/repositories/FinalRepository'
import type { PlanRepository } from '../../infrastructure/db/repositories/PlanRepository'
import type { EntityHandler } from '../history/HistoryService'

/** Bornes du texte d'une proposition (contrats MCP). */
export const FINAL_TEXT_MAX = 2000

export interface FinalDeps {
  readonly repository: Pick<
    FinalRepository,
    | 'transaction'
    | 'log'
    | 'get'
    | 'active'
    | 'list'
    | 'propose'
    | 'restore'
    | 'setState'
    | 'setArchived'
    | 'setOffset'
    | 'setSize'
  >
  readonly plan: Pick<PlanRepository, 'node' | 'children' | 'pendingProposals'>
  readonly now?: () => Date
}

/**
 * Actions finales (spec 013 US1) : Claude propose qu'une étape feuille devienne une action exécutable ; mentalyas
 * accepte (lot d'Historique annulable) ou refuse ; une action prête ou à revoir peut être rétrogradée.
 */
export class FinalService {
  constructor(private readonly deps: FinalDeps) {}

  /** Proposition de Claude (ou nouvelle proposition qui remplace celle en attente). */
  propose(input: {
    readonly neuronId: string
    readonly deliverable: string
    readonly reason: string
    readonly origin: 'user' | 'claude'
  }): void {
    const { repository, plan } = this.deps
    const node = plan.node(input.neuronId)
    if (node === undefined) throw new AppError('NOT_FOUND', 'Nœud introuvable')
    if (node.kind !== 'step') {
      throw new AppError('VALIDATION', 'Seule une étape d’un plan d’attaque peut devenir une action finale.')
    }
    if (plan.children(node.id).length > 0) {
      throw new AppError('VALIDATION', 'Cette étape a des sous-étapes : une action finale est toujours une feuille.')
    }
    if (plan.pendingProposals(node.id).length > 0) {
      throw new AppError(
        'VALIDATION',
        'Des sous-étapes sont proposées pour cette étape : mentalyas doit d’abord les décider.'
      )
    }
    const current = repository.active(node.id)
    if (current !== undefined && current.state !== 'proposee') {
      throw new AppError('VALIDATION', 'Cette étape est déjà une action finale.')
    }
    const deliverable = input.deliverable.trim()
    const reason = input.reason.trim()
    if (deliverable === '' || reason === '' || deliverable.length > FINAL_TEXT_MAX || reason.length > FINAL_TEXT_MAX) {
      throw new AppError('VALIDATION', `Livrable et raison : de 1 à ${FINAL_TEXT_MAX} caractères.`)
    }
    repository.transaction(() =>
      repository.propose({
        neuronId: node.id,
        genesisId: node.genesisId,
        deliverable,
        reason,
        origin: input.origin,
        proposedAt: this.now()
      })
    )
  }

  /** Accepter (annulable) ou refuser (la proposition disparaît, sans trace, comme un fantôme refusé). */
  decide(
    neuronId: string,
    accept: boolean
  ): { readonly state: FinalState | 'archived'; readonly batchId: string | null } {
    const { repository } = this.deps
    const action = this.transition(neuronId, accept ? 'accept' : 'refuse')
    if (!accept) {
      repository.setArchived(neuronId, this.now())
      return { state: 'archived', batchId: null }
    }
    const batchId = randomUUID()
    repository.transaction(() => {
      repository.setState(neuronId, 'prete', this.now())
      repository.log(
        batchId,
        [
          this.entry(
            action,
            { state: 'proposee', title: this.title(neuronId) },
            { state: 'prete', title: this.title(neuronId) }
          )
        ],
        'user'
      )
    })
    return { state: 'prete', batchId }
  }

  /** L'action redevient une étape ordinaire (annulable) ; impossible pendant une exécution. */
  demote(neuronId: string): { readonly batchId: string } {
    const { repository } = this.deps
    const action = this.transition(neuronId, 'demote')
    const batchId = randomUUID()
    repository.transaction(() => {
      repository.setArchived(neuronId, this.now())
      repository.log(batchId, [this.entry(action, { state: action.state, title: this.title(neuronId) }, null)], 'user')
    })
    return { batchId }
  }

  /** Livrable glissé par mentalyas : décalage par rapport à sa place d'annexe (non historisé, comme un document). */
  move(neuronId: string, x: number, y: number): void {
    if (this.deps.repository.active(neuronId) === undefined) throw new AppError('NOT_FOUND', 'Livrable introuvable')
    this.deps.repository.setOffset(neuronId, x, y)
  }

  resize(neuronId: string, width: number, height: number): void {
    if (this.deps.repository.active(neuronId) === undefined) throw new AppError('NOT_FOUND', 'Livrable introuvable')
    this.deps.repository.setSize(neuronId, width, height)
  }

  /** Action vivante de l'étape (proposée ou acceptée). */
  actionOf(neuronId: string): FinalActionRow | undefined {
    return this.deps.repository.active(neuronId)
  }

  /** L'étape est-elle une action finale acceptée ? (le plan d'attaque refuse alors de la découper) */
  isFinal(neuronId: string): boolean {
    const action = this.deps.repository.active(neuronId)
    return action !== undefined && action.state !== 'proposee'
  }

  list(): FinalActionRow[] {
    return this.deps.repository.list()
  }

  /** Entité `final_action` de l'Historique : état de l'action, `null` si elle a quitté la carte. */
  historyHandlers(): Readonly<Record<string, EntityHandler>> {
    const { repository } = this.deps
    return {
      final_action: {
        snapshot: (id) => {
          const action = repository.active(id)
          return action === undefined ? null : { state: action.state }
        },
        apply: (id, target) => {
          const row = repository.get(id)
          if (row === undefined) return
          const state = target?.['state']
          if (target === null || typeof state !== 'string') {
            repository.setArchived(id, this.now())
            return
          }
          repository.restore(id, { ...row, state: state as FinalState, archivedAt: null }, this.now())
        }
      }
    }
  }

  private transition(neuronId: string, command: FinalCommand): FinalActionRow {
    const action = this.deps.repository.active(neuronId)
    if (action === undefined) throw new AppError('NOT_FOUND', 'Action finale introuvable')
    if (nextFinalState(action.state, command) === null) {
      throw new AppError(
        'INVALID_STATE',
        action.state === 'en_cours'
          ? 'Claude exécute cette action : arrête l’exécution d’abord.'
          : 'Cette action n’est plus dans cet état.'
      )
    }
    return action
  }

  private entry(action: FinalActionRow, before: unknown, after: unknown) {
    return { kind: 'final' as const, entity: 'final_action', entityId: action.neuronId, before, after }
  }

  private title(neuronId: string): string {
    return this.deps.plan.node(neuronId)?.title ?? ''
  }

  private now(): string {
    return (this.deps.now?.() ?? new Date()).toISOString()
  }
}
