import type { CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { StepStatus } from '@shared/ipc/canvas'
import type { PlanBarNodeType, PlanNodeType } from '../buildGraph'
import { planSize } from '../planLayout'
import { usePlanDecide } from '../usePlanDecide'

export const STEP_STATUS_LABELS: Readonly<Record<StepStatus, string>> = {
  a_faire: 'à faire',
  en_cours: 'en cours',
  fait: 'fait',
  bloque: 'bloqué'
}

/** Cadenas d'un nœud verrouillé (spec 011) : ses sous-nœuds s'appuient sur son contexte figé. */
export function LockIcon({ className = '' }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" className={className}>
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

/** Poignées invisibles : React Flow ne trace un trait (genesis → étape → sous-étape) que vers un nœud qui en a. */
function PlanHandles(): React.JSX.Element {
  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} className="neuron-handle" />
      <Handle type="source" position={Position.Right} isConnectable={false} className="neuron-handle" />
    </>
  )
}

/**
 * Étape d'un plan d'attaque, ou fantôme proposé par Claude (spec 011). Étape : carte arrondie, pastille de rang,
 * statut, cadenas ; un clic ouvre sa conversation (géré par la carte). Fantôme : pointillés, ✓ / ✗.
 */
export function PlanNode({ data }: NodeProps<PlanNodeType>): React.JSX.Element {
  const { item, color, dimmed } = data
  const { decide, busy } = usePlanDecide()
  const depth = item.kind === 'step' ? item.step.depth : item.depth
  const size = planSize(depth)
  const style = { width: size.width, height: size.height, '--cat': color } as CSSProperties
  const compact = depth > 1

  if (item.kind === 'ghost') {
    const { ghost } = item
    return (
      <div
        className={`nopan plan-card plan-ghost${compact ? ' plan-card-compact' : ''}${dimmed ? ' plan-dimmed' : ''}`}
        style={style}
        title={ghost.why}
      >
        <PlanHandles />
        <span className="plan-rank">{item.label}</span>
        <span className="plan-title">{ghost.title}</span>
        <span className="flex shrink-0 gap-1">
          <button
            type="button"
            className="nodrag plan-decide"
            aria-label={`Valider l’étape « ${ghost.title} »`}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation()
              void decide({ proposalId: item.proposalId, accept: [ghost.id], reject: [] })
            }}
          >
            ✓
          </button>
          <button
            type="button"
            className="nodrag plan-decide"
            aria-label={`Refuser l’étape « ${ghost.title} »`}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation()
              void decide({ proposalId: item.proposalId, accept: [], reject: [ghost.id] })
            }}
          >
            ✗
          </button>
        </span>
      </div>
    )
  }

  const { step } = item
  return (
    <div
      className={`nopan plan-card plan-step plan-status-${step.status}${compact ? ' plan-card-compact' : ''}${dimmed ? ' plan-dimmed' : ''}`}
      style={style}
    >
      <PlanHandles />
      <span className="plan-rank">{item.label}</span>
      <span className="min-w-0 flex-1">
        <span className="plan-title">{step.title}</span>
        {compact ? null : <span className="plan-status">{STEP_STATUS_LABELS[step.status]}</span>}
      </span>
      {step.locked ? <LockIcon className="shrink-0 text-content-muted" /> : null}
    </div>
  )
}

/** Barre d'une couche proposée : tout valider ou tout refuser d'un geste (spec 011 US1). */
export function PlanBarNode({ data }: NodeProps<PlanBarNodeType>): React.JSX.Element {
  const { proposal } = data
  const { decide, busy } = usePlanDecide()
  const ids = proposal.items.map((item) => item.id)
  const count = ids.length
  return (
    <div className="nopan plan-bar">
      <span className="min-w-0 flex-1 truncate">
        Claude propose {count} étape{count > 1 ? 's' : ''}
      </span>
      <button
        type="button"
        className="nodrag plan-bar-action plan-bar-primary"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation()
          void decide({ proposalId: proposal.id, accept: ids, reject: [] })
        }}
      >
        Tout valider
      </button>
      <button
        type="button"
        className="nodrag plan-bar-action"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation()
          void decide({ proposalId: proposal.id, accept: [], reject: ids })
        }}
      >
        Tout refuser
      </button>
    </div>
  )
}
