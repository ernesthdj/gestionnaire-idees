import { isAbsolute, relative, sep } from 'node:path'
import type { ToolResult } from '@shared/mcp/protocol'
import type { EcritureAvantInput } from '@shared/mcp/tools'
import { checkProjectPath } from '../../domain/finals/projectPath'
import type { FinalRepository } from '../../infrastructure/db/repositories/FinalRepository'
import type { ProjectFiles } from '../../infrastructure/finals/ProjectFiles'

export interface DeliverableTrackerDeps {
  readonly finals: Pick<FinalRepository, 'get' | 'file'>
  /** Dossier de projet lié au genesis ; `null` : aucun. */
  readonly projectDir: (genesisId: string) => string | null
  readonly files: Pick<ProjectFiles, 'read'>
  /** Enregistre l'écriture au livrable (`ExecutionService.recordWrite`). */
  readonly record: (neuronId: string, relative: string, before: string | null, next: string) => void
  /**
   * Éléments de la carte de structure : un fichier écrit pendant la conversation d'un élément rejoint ses chemins,
   * pour qu'il reste consultable pendant le travail (pas seulement une fois l'élément livré).
   */
  readonly elements?: {
    /** Dossier de projet lié si le neurone est un élément de carte ; `null` sinon. */
    readonly projectDir: (neuronId: string) => string | null
    readonly addPath: (neuronId: string, relative: string) => void
  }
  readonly now?: () => number
}

/** Une écriture annoncée sans résultat (refus, processus arrêté) est oubliée au bout de 30 minutes. */
const PENDING_TTL_MS = 30 * 60_000

interface PendingWrite {
  readonly neuronId: string
  readonly relative: string
  readonly before: string | null
  readonly at: number
  /** Conversation d'un élément de carte : seul le chemin est retenu, sans contenu. */
  readonly element: boolean
}

const IGNORED: ToolResult = { text: 'ignoré' }

/**
 * Livrable des actions finales reconstitué à partir des écritures réelles de Claude (spec 014 R5, FR-010) : le hook
 * `PreToolUse` annonce l'écriture (le contenu d'avant est lu ici), le résultat réussi de l'outil la confirme (le
 * contenu d'après est relu). Seules les conversations d'une action finale acceptée sont suivies, et seulement dans le
 * dossier du projet lié, hors fichiers sensibles ou binaires. Dans la conversation d'un élément de carte de structure,
 * seul le chemin du fichier écrit est retenu (il rejoint les chemins de l'élément). Le hook ne bloque jamais une écriture : le suivi est un
 * constat, la permission reste l'affaire du mode de la conversation.
 */
export class DeliverableTracker {
  private readonly pending = new Map<string, PendingWrite>()

  constructor(private readonly deps: DeliverableTrackerDeps) {}

  /** Hook avant écriture (outil interne `ecriture_avant`). */
  before(neuronId: string, input: EcritureAvantInput): ToolResult {
    this.prune()
    const target = this.target(neuronId, input.file_path)
    if (target === null) return this.beforeElement(neuronId, input)
    let before: string | null
    try {
      before = this.deps.files.read(target.projectDir, target.relative)?.content ?? null
    } catch {
      // Lien qui sort du projet, fichier trop gros ou binaire : pas suivi.
      return IGNORED
    }
    this.pending.set(input.tool_use_id, {
      neuronId,
      relative: target.relative,
      before,
      at: this.now(),
      element: false
    })
    return { text: 'suivi' }
  }

  /** Résultat de l'outil (flux de la conversation) : l'écriture réussie rejoint le livrable. */
  after(neuronId: string, toolUseId: string, ok: boolean): void {
    const entry = this.pending.get(toolUseId)
    if (entry === undefined || entry.neuronId !== neuronId) return
    this.pending.delete(toolUseId)
    if (!ok) return
    if (entry.element) {
      this.deps.elements?.addPath(neuronId, entry.relative)
      return
    }
    const action = this.deps.finals.get(neuronId)
    const projectDir = action === undefined ? null : this.deps.projectDir(action.genesisId)
    if (projectDir === null) return
    let next: string | null
    try {
      next = this.deps.files.read(projectDir, entry.relative)?.content ?? null
    } catch {
      return
    }
    if (next === null) return
    const known = this.deps.finals.file(neuronId, entry.relative.toLowerCase()) !== undefined
    if (!known && next === entry.before) return
    this.deps.record(neuronId, entry.relative, entry.before, next)
  }

  /** Écritures annoncées en attente de leur résultat (tests, diagnostic). */
  pendingCount(): number {
    return this.pending.size
  }

  /** Écriture dans la conversation d'un élément de carte : on retient seulement le chemin, dans le dossier lié. */
  private beforeElement(neuronId: string, input: EcritureAvantInput): ToolResult {
    const projectDir = this.deps.elements?.projectDir(neuronId) ?? null
    const relativePath = projectDir === null ? null : this.relativeTo(projectDir, input.file_path)
    if (relativePath === null) return IGNORED
    this.pending.set(input.tool_use_id, {
      neuronId,
      relative: relativePath,
      before: null,
      at: this.now(),
      element: true
    })
    return { text: 'suivi' }
  }

  /** Chemin relatif sûr (`/`) d'un fichier absolu sous le projet ; `null` s'il en sort ou est refusé. */
  private relativeTo(projectDir: string, filePath: string): string | null {
    if (!isAbsolute(filePath)) return null
    const inside = relative(projectDir, filePath)
    if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) return null
    const check = checkProjectPath(inside.split(sep).join('/'))
    return check.ok ? check.path : null
  }

  private target(
    neuronId: string,
    filePath: string
  ): { readonly projectDir: string; readonly relative: string } | null {
    const action = this.deps.finals.get(neuronId)
    if (action === undefined || action.state === 'proposee') return null
    const projectDir = this.deps.projectDir(action.genesisId)
    if (projectDir === null) return null
    const relativePath = this.relativeTo(projectDir, filePath)
    return relativePath === null ? null : { projectDir, relative: relativePath }
  }

  private prune(): void {
    const limit = this.now() - PENDING_TTL_MS
    for (const [id, entry] of this.pending) if (entry.at < limit) this.pending.delete(id)
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now()
  }
}
