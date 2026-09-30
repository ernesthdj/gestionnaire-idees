import { useQueryClient } from '@tanstack/react-query'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import type { RootView } from '@shared/ipc/neurons'
import { useUiStore } from '../../app/uiStore'
import { call, IpcFailure } from '../../lib/ipc'
import type { StepNodeType } from '../buildGraph'
import { useCreateLink } from '../useCreateLink'

/** Taille de l'étiquette (multiples de 8) et encombrement pour la physique. */
export const STEP_SIZE = { width: 224, height: 80 } as const
export const STEP_RADIUS = 120
/** Libellé du lien entre une idée et celle née de sa prochaine étape. */
export const STEP_LINK_LABEL = 'prochaine étape'
/** Décalage de la nouvelle idée par rapport à l'étape dont elle naît. */
const BORN_OFFSET = { x: 200, y: 140 } as const

/**
 * « Prochaine étape » d'une idée, posée sur la carte (FR-037) : étiquette en flèche, texte tiré du document et NON
 * modifiable. Elle sert de point de départ : « Brainstormer cette étape » en fait une nouvelle idée de départ,
 * reliée à l'idée dont elle vient.
 */
export function StepNode({ data, positionAbsoluteX, positionAbsoluteY }: NodeProps<StepNodeType>): React.JSX.Element {
  const client = useQueryClient()
  const createLink = useCreateLink()
  const showToast = useUiStore((state) => state.showToast)
  const markBorn = useUiStore((state) => state.markBorn)
  const [busy, setBusy] = useState(false)
  const { step } = data

  const brainstorm = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      const root = await call<RootView>('neuron:create', {
        text: step.text,
        position: {
          x: Math.round(positionAbsoluteX + BORN_OFFSET.x),
          y: Math.round(positionAbsoluteY + BORN_OFFSET.y)
        }
      })
      markBorn(root.id)
      await client.invalidateQueries({ queryKey: ['canvas'] })
      await createLink({ aRootId: step.rootId, bRootId: root.id, label: STEP_LINK_LABEL })
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'La nouvelle idée n’a pas pu être créée.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`step${data.dimmed ? ' step-dimmed' : ''}`} style={STEP_SIZE}>
      <div className="step-tag" aria-hidden="true">
        <div className="step-tag-inner">
          <p className="step-heading">
            → Prochaine étape <span title="Tirée du document : non modifiable">🔒</span>
          </p>
          <p className="step-text">{step.text}</p>
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation()
          void brainstorm()
        }}
        aria-label={`Brainstormer cette étape : ${step.text}`}
        className="nodrag step-action"
      >
        Brainstormer cette étape
      </button>
      {/* Poignée invisible au centre : le trait qui relie l'étape à son idée y arrive. */}
      <Handle type="target" position={Position.Top} isConnectable={false} className="neuron-handle" />
    </div>
  )
}
