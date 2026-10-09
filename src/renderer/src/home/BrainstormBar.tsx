import type { HubAnomaly } from '@shared/ipc/brainstorms'
import { useUiStore } from '../app/uiStore'
import { Button } from '../components/atoms/Button'
import { flushViewState } from './useBrainstorms'
import { SavePoints } from '../canvas/SavePoints'

const since = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })
}

/** Une anomalie de `/hub work` en mots (spec 024 US1 scénario 4). */
export function anomalyText(anomaly: HubAnomaly): string {
  switch (anomaly.kind) {
    case 'session_here':
      return `Une session /hub est ouverte sur ce projet depuis le ${since(anomaly.since)} (terminal).`
    case 'session_elsewhere':
      return `Une session /hub est restée ouverte sur « ${anomaly.slug} » depuis le ${since(anomaly.since)} : pense à /hub end.`
    case 'uncommitted':
      return `${anomaly.count} fichier${anomaly.count > 1 ? 's' : ''} non commité${anomaly.count > 1 ? 's' : ''} : volet Dépôt.`
    case 'unpushed':
      return `${anomaly.count} commit${anomaly.count > 1 ? 's' : ''} non poussé${anomaly.count > 1 ? 's' : ''}.`
    case 'behind':
      return `Le distant a ${anomaly.count} commit${anomaly.count > 1 ? 's' : ''} d’avance.`
  }
}

/**
 * Bandeau du brainstorm ouvert (spec 024) : son nom, retour au Project Manager, et ce que `/hub work` a relevé à
 * l'ouverture (anomalies, dernières entrées du JOURNAL), refermable. Les actions restent sur clic (volet Dépôt).
 */
export function BrainstormBar(): React.JSX.Element | null {
  const brainstorm = useUiStore((state) => state.brainstorm)
  const summary = useUiStore((state) => state.openSummary)
  const dismiss = useUiStore((state) => state.dismissSummary)
  const show = useUiStore((state) => state.show)
  const openRepo = useUiStore((state) => state.openRepo)
  if (brainstorm === null) return null
  const gitIssue = summary?.anomalies.some((anomaly) => anomaly.kind === 'uncommitted' || anomaly.kind === 'unpushed')
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-content-muted/20 px-4 py-2">
      <div className="flex items-center gap-3">
        <Button
          className="shrink-0"
          onClick={() => {
            // La vue est écrite tout de suite (sans attendre le différé) : fermer l'app juste après ne la perd pas.
            void flushViewState()
            show('home')
          }}
        >
          ← Projets
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="font-semibold">{brainstorm.name}</span>
          {brainstorm.folder === null ? null : (
            <span className="ml-2 font-mono text-xs text-content-muted">{brainstorm.folder}</span>
          )}
        </p>
        <SavePoints brainstormId={brainstorm.id} />
      </div>
      {summary === null ? null : (
        <section
          aria-label="À l’ouverture"
          className="flex items-start gap-4 rounded-md border border-content-muted/30 bg-surface-raised p-3 text-xs"
        >
          {summary.anomalies.length === 0 ? null : (
            <ul className="flex flex-1 flex-col gap-1" aria-label="Points à regarder">
              {summary.anomalies.map((anomaly) => (
                <li key={anomaly.kind}>⚠ {anomalyText(anomaly)}</li>
              ))}
            </ul>
          )}
          {summary.journal.length === 0 ? null : (
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="font-semibold">Dernières entrées du JOURNAL</p>
              <ul className="flex flex-col gap-1 text-content-muted">
                {summary.journal.slice(0, 3).map((entry) => (
                  <li key={entry} className="truncate" title={entry}>
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex shrink-0 flex-col gap-1">
            {gitIssue === true && brainstorm.genesisId !== null ? (
              <Button onClick={() => brainstorm.genesisId !== null && openRepo(brainstorm.genesisId)}>
                Ouvrir le volet Dépôt
              </Button>
            ) : null}
            <Button onClick={dismiss}>Fermer</Button>
          </div>
        </section>
      )}
    </div>
  )
}
