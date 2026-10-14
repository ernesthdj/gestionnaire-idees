import { useQueryClient } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'
import type { ExplorerMapView, RepriseProjectView } from '@shared/ipc/reprise'
import { ARCHITECTURE_KINDS, ARCHITECTURES, type ArchitectureKind } from '@shared/structure/architecture'
import { detectArchitecture } from '@shared/structure/detect'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'

const fileOf = (key: string): string => key.replace(/^f:/, '')

/**
 * Détecteur d'architecture en tête de l'explorateur (spec 032 D15) : l'architecture reconnue par les règles (noms des
 * dossiers, sens des appels) et sa raison ; celle précisée par Claude ou choisie par mentalyas prime. mentalyas la
 * corrige ici (annulable dans l'Historique, spec 017 D20).
 */
export function ArchitectureDetector({
  genesisId,
  map,
  stored
}: {
  readonly genesisId: string
  readonly map: ExplorerMapView
  readonly stored: RepriseProjectView['architecture']
}): React.JSX.Element {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const [busy, setBusy] = useState(false)
  const selectId = useId()
  const detected = useMemo(
    () =>
      detectArchitecture({
        paths: map.files.map((file) => file.path),
        calls: map.calls.map((call) => ({ from: fileOf(call.from), to: fileOf(call.to) }))
      }),
    [map]
  )
  const kind = stored?.kind ?? detected.kind

  const choose = async (next: ArchitectureKind): Promise<void> => {
    setBusy(true)
    try {
      const { batchId } = await call<{ readonly batchId: string }>('structure:setArchitecture', {
        genesisId,
        kind: next
      })
      showToast(`Architecture : ${ARCHITECTURES[next].label}.`, {
        batchId,
        undoneText: 'Architecture remise comme avant.'
      })
      await Promise.all([
        client.invalidateQueries({ queryKey: ['reprise', genesisId] }),
        client.invalidateQueries({ queryKey: ['canvas'] })
      ])
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'L’architecture n’a pas pu être changée.')
    } finally {
      setBusy(false)
    }
  }

  const source =
    stored === null ? 'reconnue par l’app' : stored.source === 'user' ? 'choisie par toi' : 'précisée par Claude'
  // La raison montrée : celle de Claude s'il en a donné une, sinon celle du détecteur (dite telle quelle si mentalyas
  // a choisi autre chose, pour qu'il voie ce que l'app lit dans le code).
  const reason =
    stored?.source === 'claude' && stored.reason !== null
      ? stored.reason
      : stored === null || stored.kind === detected.kind
        ? detected.reason
        : `L’app y voit : ${ARCHITECTURES[detected.kind].label}. ${detected.reason}`

  return (
    <div role="group" aria-label="Architecture du projet" className="flex flex-wrap items-center gap-2 text-xs">
      <label htmlFor={selectId} className="font-semibold">
        Architecture
      </label>
      <select
        id={selectId}
        value={kind}
        disabled={busy}
        onChange={(event) => void choose(event.target.value as ArchitectureKind)}
        className="h-7 rounded-md border border-content-muted/40 bg-surface px-1 text-content"
      >
        {ARCHITECTURE_KINDS.map((entry) => (
          <option key={entry} value={entry}>
            {ARCHITECTURES[entry].label}
          </option>
        ))}
      </select>
      <span className="text-content-muted">{source}</span>
      <span className="text-content-muted">· {reason}</span>
    </div>
  )
}
