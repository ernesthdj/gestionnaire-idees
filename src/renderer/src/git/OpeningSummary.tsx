import type { HubAnomaly } from '@shared/ipc/brainstorms'
import { useUiStore } from '../app/uiStore'

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
      return `${anomaly.count} fichier${anomaly.count > 1 ? 's' : ''} non commité${anomaly.count > 1 ? 's' : ''}.`
    case 'unpushed':
      return `${anomaly.count} commit${anomaly.count > 1 ? 's' : ''} non poussé${anomaly.count > 1 ? 's' : ''}.`
    case 'behind':
      return `Le distant a ${anomaly.count} commit${anomaly.count > 1 ? 's' : ''} d’avance.`
  }
}

/**
 * Ce que `/hub work` a relevé à l'ouverture du projet (spec 024), dans le volet Dépôt (spec 033 D6) : les points à
 * regarder et les dernières entrées du JOURNAL, repliables. L'état git en direct reste en tête du volet.
 */
export function OpeningSummary(): React.JSX.Element | null {
  const summary = useUiStore((state) => state.openSummary)
  if (summary === null) return null
  return (
    <details open className="rounded-md border border-content-muted/30 p-2 text-xs">
      <summary className="cursor-pointer font-semibold">À l’ouverture du projet</summary>
      {summary.anomalies.length === 0 ? null : (
        <ul className="mt-2 flex flex-col gap-1 text-action" aria-label="Points à regarder">
          {summary.anomalies.map((anomaly) => (
            <li key={anomaly.kind}>⚠ {anomalyText(anomaly)}</li>
          ))}
        </ul>
      )}
      {summary.journal.length === 0 ? null : (
        <>
          <p className="mt-2 font-semibold">Dernières entrées du JOURNAL</p>
          <ul className="mt-1 flex flex-col gap-1 text-content-muted">
            {summary.journal.slice(0, 3).map((entry) => (
              <li key={entry} className="truncate" title={entry}>
                {entry}
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  )
}
