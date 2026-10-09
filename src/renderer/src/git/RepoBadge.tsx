import type { GitStatusView } from '@shared/git/model'
import { useUiStore } from '../app/uiStore'
import { IpcFailure } from '../lib/ipc'
import { useGitStatus } from './gitQueries'

/** Texte de l'état du dépôt (jamais la couleur seule). */
export function repoStateText(status: GitStatusView): string {
  if (status.state === 'no_repo') return 'pas de git'
  if (status.state === 'risky_config') return 'configuration à risque'
  if (status.operation === 'merge') return 'fusion en cours'
  if (status.operation === 'other') return 'opération en cours hors de l’app'
  const changed = new Set(status.files.map((file) => file.path)).size
  const branch = status.detached ? 'HEAD détachée' : (status.branch ?? '?')
  const parts = [`⎇ ${branch}`, changed === 0 ? 'à jour' : `${changed} modifié${changed > 1 ? 's' : ''}`]
  if (status.ahead > 0) parts.push(`↑${status.ahead}`)
  if (status.behind > 0) parts.push(`↓${status.behind}`)
  // Commits du distant arrivés depuis la dernière visite (spec 021 US3).
  if (status.newSinceVisit > 0) parts.push(`✦ ${status.newSinceVisit} nouveauté${status.newSinceVisit > 1 ? 's' : ''}`)
  return parts.join(' · ')
}

/**
 * Badge du dépôt sur le genesis d'un projet lié (spec 021 T016) : branche et nombre de fichiers modifiés ; un clic ouvre
 * le volet Dépôt. Dossier introuvable ou git absent : dit en clair.
 */
export function RepoBadge({ genesisId }: { readonly genesisId: string }): React.JSX.Element | null {
  const openRepo = useUiStore((state) => state.openRepo)
  const query = useGitStatus(genesisId)
  const text =
    query.data !== undefined
      ? repoStateText(query.data)
      : query.error instanceof IpcFailure && query.error.code === 'DIR_MISSING'
        ? 'dossier introuvable'
        : query.error instanceof IpcFailure && query.error.code === 'GIT_MISSING'
          ? 'git introuvable'
          : null
  if (text === null) return null
  return (
    <button
      type="button"
      className="living-repo nodrag absolute left-1/2 -top-7 -translate-x-1/2 whitespace-nowrap rounded-full border border-content-muted/30 bg-surface-raised px-2 py-0.5 text-[11px] text-content hover:bg-surface"
      title="Ouvrir le volet Dépôt (Ctrl+Maj+G)"
      aria-label={`Dépôt : ${text}. Ouvrir le volet Dépôt`}
      onClick={(event) => {
        event.stopPropagation()
        openRepo(genesisId)
      }}
    >
      {text}
    </button>
  )
}
