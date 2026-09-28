/** Vues partagées de l'import de contexte (contracts/ipc-ai.md § context:*). */

export interface ContextVersionView {
  readonly id: string
  readonly version: number
  readonly source: 'seed' | 'import'
  readonly isActive: boolean
  readonly appliedAt: string
}

export interface ActiveContextView extends ContextVersionView {
  readonly profile: string
  readonly rules: string
}

export interface ContextListView {
  readonly active: ActiveContextView | null
  readonly versions: readonly ContextVersionView[]
  readonly imports: readonly { id: string; detectedAt: string; status: string; error: string | null }[]
  /** Dossier où Claude Code dépose les fichiers de contexte. */
  readonly inboxPath: string
}

export interface TextDiffView {
  readonly before: string
  readonly after: string
  readonly changed: boolean
}

export interface PendingImportView {
  readonly id: string
  readonly detectedAt: string
  readonly diff: {
    readonly files: readonly string[]
    readonly profile: TextDiffView
    readonly rules: TextDiffView
    readonly examples: { readonly before: number; readonly after: number }
  }
}
