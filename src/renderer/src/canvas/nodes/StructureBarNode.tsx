import { useQueryClient } from '@tanstack/react-query'
import type { NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { ARCHITECTURE_KINDS, ARCHITECTURES, type ArchitectureKind } from '@shared/structure/architecture'
import { useUiStore, type StructureView } from '../../app/uiStore'
import { call, IpcFailure } from '../../lib/ipc'
import type { StructureBarNodeType } from '../buildGraph'
import { useMapping } from '../mapping/mappingStore'
import { RunButton } from '../../run/RunButton'

/**
 * Barre d'une carte de projet lié (spec 017 D20, spec 023 D3) : bascule « Workflow | Progression | Architecture » et
 * architecture de la carte, reconnue par Claude ou choisie par mentalyas (sa correction prime, annulable dans
 * l'Historique). Sans carte de structure dessinée, seule la vue Workflow est possible ; en Workflow, « Relire » relit
 * les fichiers du projet.
 */
export function StructureBarNode({ data }: NodeProps<StructureBarNodeType>): React.JSX.Element {
  const { genesisId, view, hasMap, architecture } = data
  const client = useQueryClient()
  const setStructureView = useUiStore((state) => state.setStructureView)
  const showToast = useUiStore((state) => state.showToast)
  const [busy, setBusy] = useState(false)
  const mapping = useMapping((state) => state.phases[genesisId] === 'running')

  /**
   * « Mettre à jour la carte » (spec 022, 2026-10-10) : l'app liste ce qui a changé depuis la dernière cartographie ;
   * Claude ne met à jour que les éléments concernés, dans la conversation du genesis (l'orbe montre l'avancement).
   */
  const update = async (): Promise<void> => {
    setBusy(true)
    try {
      const plan = await call<{ readonly prompt: string | null; readonly files: number }>('structure:updatePlan', {
        genesisId
      })
      if (plan.prompt === null) {
        showToast('Rien n’a changé depuis la dernière cartographie : la carte est à jour.')
        return
      }
      useMapping.getState().start(genesisId)
      await call('chat:send', { neuronId: genesisId, text: plan.prompt })
      showToast(`Mise à jour de la carte lancée : ${plan.files} fichier(s) changé(s).`)
    } catch (error) {
      useMapping.getState().finish(genesisId, false)
      showToast(error instanceof IpcFailure ? error.message : 'La mise à jour de la carte n’a pas pu démarrer.')
    } finally {
      setBusy(false)
    }
  }
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

  const segment = (target: StructureView, label: string, disabled = false): React.JSX.Element => (
    <button
      type="button"
      aria-pressed={view === target}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        setStructureView(genesisId, target)
      }}
      title={
        !disabled
          ? undefined
          : hasMap
            ? 'Cartographie le projet ou choisis son architecture pour voir ses couches'
            : 'Cartographie le projet pour voir sa structure'
      }
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
        {segment('workflow', 'Workflow')}
        {segment('progression', 'Progression', !hasMap)}
        {segment('architecture', 'Architecture', !hasMap || !canLayer)}
      </div>
      {view === 'workflow' ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            void client.invalidateQueries({ queryKey: ['workflow', genesisId] })
          }}
          title="Relire les specs et les tâches du projet"
          className="h-7 rounded-md border border-content-muted/40 px-2 text-xs text-content hover:bg-surface"
        >
          Relire
        </button>
      ) : null}
      <RunButton genesisId={genesisId} />
      {!hasMap ? null : (
        <button
          type="button"
          disabled={busy || mapping}
          onClick={(event) => {
            event.stopPropagation()
            void update()
          }}
          aria-label={mapping ? 'Mise à jour de la carte en cours' : 'Mettre à jour la carte'}
          title="Mettre à jour la carte avec les derniers changements du projet (Claude ne touche qu’aux éléments concernés)"
          className="h-7 shrink-0 whitespace-nowrap rounded-md border border-content-muted/40 px-2 text-xs text-content hover:bg-surface disabled:opacity-50"
        >
          {mapping ? 'Mise à jour…' : '↻ Mettre à jour'}
        </button>
      )}
      {!hasMap ? null : (
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
      )}
      {!hasMap || architecture === null ? null : (
        <span className="text-[11px] text-content-muted" title={architecture.reason ?? undefined}>
          {architecture.source === 'user' ? 'choisie par toi' : 'reconnue par Claude'}
        </span>
      )}
    </div>
  )
}
