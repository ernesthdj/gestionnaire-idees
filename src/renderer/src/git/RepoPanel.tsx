import { useId, useState } from 'react'
import { IpcFailure } from '../lib/ipc'
import { BranchesTab } from './BranchesTab'
import { ChangesTab } from './ChangesTab'
import { useGitStatus } from './gitQueries'
import { HistoryTab } from './HistoryTab'
import { repoStateText } from './RepoBadge'

type Tab = 'changes' | 'branches' | 'history'
const TABS: readonly { readonly tab: Tab; readonly label: string }[] = [
  { tab: 'changes', label: 'Changements' },
  { tab: 'branches', label: 'Branches' },
  { tab: 'history', label: 'Historique' }
]

/**
 * Volet Dépôt d'un projet (spec 021 T016, US1), à côté de la carte : état en tête, onglets Changements, Branches,
 * Historique. Configuration à risque (dépôt non de confiance) : aucune commande, explication et sortie ; opération
 * lancée hors de l'app (rebase, fusion en terminal) : lecture seule. L'état se relit au retour du focus.
 */
export function RepoPanel({
  genesisId,
  onClose
}: {
  readonly genesisId: string
  readonly onClose: () => void
}): React.JSX.Element {
  const titleId = useId()
  const [tab, setTab] = useState<Tab>('changes')
  const query = useGitStatus(genesisId)
  const status = query.data
  const readOnly = status?.operation === 'other'

  return (
    <aside
      aria-labelledby={titleId}
      className="flex h-full w-[38%] min-w-[360px] shrink-0 flex-col gap-3 overflow-hidden border-l border-content-muted/20 bg-surface p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-semibold">
            Dépôt
          </h2>
          <p className="truncate text-xs text-content-muted" role="status">
            {status === undefined ? 'Lecture du dépôt…' : repoStateText(status)}
            {status?.trusted === true ? ' · projet de confiance (hooks actifs)' : ''}
          </p>
        </div>
        <button type="button" className="detail-card-close" aria-label="Fermer le volet Dépôt" onClick={onClose}>
          ✕
        </button>
      </div>
      {query.error !== null ? (
        <p role="alert" className="text-sm text-con">
          {query.error instanceof IpcFailure ? query.error.message : 'Le dépôt n’a pas pu être lu.'}
        </p>
      ) : status === undefined ? null : status.state === 'no_repo' ? (
        <p className="text-sm text-content-muted">
          Ce projet n’est pas encore un dépôt git : « Initialiser git » depuis la carte du projet (spec 016).
        </p>
      ) : status.state === 'risky_config' ? (
        <div role="alert" className="flex flex-col gap-2 rounded-md border border-con/50 p-3 text-sm">
          <p className="font-semibold">Configuration à risque : aucune commande git n’est lancée.</p>
          <p>
            Ce dépôt déclare des réglages qui peuvent exécuter un programme dès une simple lecture. Vérifie-les en
            terminal (<span className="font-mono">git config --local --list</span>), retire-les, ou marque le projet de
            confiance dans les réglages si tu les connais.
          </p>
          <ul className="font-mono text-xs">
            {status.riskyConfig.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          {readOnly ? (
            <p role="status" className="rounded-md border border-content-muted/40 p-2 text-sm">
              Une opération git est en cours hors de l’app (rebase, fusion…) : le volet est en lecture seule. Termine-la
              en terminal.
            </p>
          ) : null}
          <div role="tablist" aria-label="Volet Dépôt" className="flex gap-1 border-b border-content-muted/20">
            {TABS.map((entry) => (
              <button
                key={entry.tab}
                type="button"
                role="tab"
                id={`${titleId}-${entry.tab}`}
                aria-selected={tab === entry.tab}
                aria-controls={`${titleId}-${entry.tab}-panel`}
                onClick={() => setTab(entry.tab)}
                className={`-mb-px border-b-2 px-3 py-1 text-sm ${
                  tab === entry.tab ? 'border-accent font-semibold' : 'border-transparent text-content-muted'
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`${titleId}-${tab}-panel`}
            aria-labelledby={`${titleId}-${tab}`}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto"
          >
            {tab === 'changes' ? (
              <ChangesTab genesisId={genesisId} status={status} readOnly={readOnly} />
            ) : tab === 'branches' ? (
              <BranchesTab genesisId={genesisId} readOnly={readOnly} />
            ) : (
              <HistoryTab genesisId={genesisId} readOnly={readOnly} />
            )}
          </div>
        </>
      )}
    </aside>
  )
}
