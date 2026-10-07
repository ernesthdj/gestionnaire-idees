import { useQueryClient } from '@tanstack/react-query'
import type { NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { ARCHITECTURE_KINDS, ARCHITECTURES, type ArchitectureKind } from '@shared/structure/architecture'
import { useUiStore } from '../../app/uiStore'
import { call, IpcFailure } from '../../lib/ipc'
import type { StructureBarNodeType } from '../buildGraph'

/**
 * Barre d'une carte de structure (spec 017 D20) : bascule « Progression | Architecture » et architecture de la carte,
 * reconnue par Claude ou choisie par mentalyas (sa correction prime, annulable dans l'Historique).
 */
export function StructureBarNode({ data }: NodeProps<StructureBarNodeType>): React.JSX.Element {
  const { genesisId, view, architecture } = data
  const client = useQueryClient()
  const setStructureView = useUiStore((state) => state.setStructureView)
  const showToast = useUiStore((state) => state.showToast)
  const [busy, setBusy] = useState(false)
  const kind = architecture?.kind ?? 'aucune'
  const canLayer = kind !== 'aucune'

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
      if (next === 'aucune') setStructureView(genesisId, 'progression')
      await client.invalidateQueries({ queryKey: ['canvas'] })
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'L’architecture n’a pas pu être changée.')
    } finally {
      setBusy(false)
    }
  }

  const segment = (target: 'progression' | 'architecture', label: string, disabled = false): React.JSX.Element => (
    <button
      type="button"
      aria-pressed={view === target}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        setStructureView(genesisId, target)
      }}
      title={disabled ? 'Cartographie le projet ou choisis son architecture pour voir ses couches' : undefined}
      className={`h-7 px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
        view === target ? 'bg-accent text-surface' : 'text-content hover:bg-surface'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div
      role="group"
      aria-label="Lecture de la carte de structure"
      className="nodrag flex items-center gap-3 rounded-lg border border-content-muted/30 bg-surface-raised px-3 py-2 shadow-sm"
    >
      <div className="flex overflow-hidden rounded-md border border-content-muted/40">
        {segment('progression', 'Progression')}
        {segment('architecture', 'Architecture', !canLayer)}
      </div>
      <label className="flex items-center gap-2 text-xs text-content-muted">
        Architecture
        <select
          value={kind}
          disabled={busy}
          onChange={(event) => void choose(event.target.value as ArchitectureKind)}
          onClick={(event) => event.stopPropagation()}
          className="h-7 rounded-md border border-content-muted/40 bg-surface px-1 text-xs text-content"
        >
          {ARCHITECTURE_KINDS.map((entry) => (
            <option key={entry} value={entry}>
              {ARCHITECTURES[entry].label}
            </option>
          ))}
        </select>
      </label>
      {architecture === null ? null : (
        <span className="text-[11px] text-content-muted" title={architecture.reason ?? undefined}>
          {architecture.source === 'user' ? 'choisie par toi' : 'reconnue par Claude'}
        </span>
      )}
    </div>
  )
}
