import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { StepStatus, StepView } from '@shared/ipc/canvas'
import type { FinalState } from '@shared/ipc/finals'
import { useUiStore } from '../../app/uiStore'
import type { PlanBarNodeType, PlanNodeType } from '../buildGraph'
import { LivingNode } from '../living/LivingNode'
import type { NodeStatus } from '../living/nodeVisual'
import { useFinalDecide } from '../useFinalDecide'
import { usePlanDecide } from '../usePlanDecide'
import { usePlanFold } from '../usePlanFold'

export const STEP_STATUS_LABELS: Readonly<Record<StepStatus, string>> = {
  a_faire: 'à faire',
  en_cours: 'en cours',
  fait: 'fait',
  bloque: 'bloqué'
}

/** État lisible d'une action finale ; « faite » vient du statut de l'étape (livrable accepté). */
export function finalStateLabel(state: FinalState, status: StepStatus): string {
  if (state === 'proposee') return 'Action finale proposée'
  if (status === 'fait') return 'Action finale · faite'
  const labels: Readonly<Record<Exclude<FinalState, 'proposee'>, string>> = {
    prete: 'Action finale · prête',
    en_cours: 'Action finale · en cours',
    a_revoir: 'Action finale · à revoir'
  }
  return labels[state]
}

/** Éclair d'une action finale (spec 013) : l'étape produit le livrable de sa branche. */
export function BoltIcon({ className = '' }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" className={className}>
      <path d="M9.5 1 3 9h4l-1 6 6.5-8h-4z" fill="currentColor" />
    </svg>
  )
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
      <Handle id="left" type="target" position={Position.Left} isConnectable={false} className="neuron-handle" />
      <Handle id="right" type="source" position={Position.Right} isConnectable={false} className="neuron-handle" />
      <Handle id="top" type="target" position={Position.Top} isConnectable={false} className="neuron-handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} isConnectable={false} className="neuron-handle" />
    </>
  )
}

/** Statut d'avancement d'une étape → pastille d'un nœud vivant. */
export const STEP_NODE_STATUS: Readonly<Record<StepStatus, NodeStatus>> = {
  a_faire: 'todo',
  en_cours: 'doing',
  fait: 'done',
  bloque: 'blocked'
}

/** Valider ou refuser une étape proposée par Claude (✓ / ✗) : sur le nœud du fantôme et dans sa carte de détails. */
export function GhostDecision({
  title,
  proposalId,
  ghostId
}: {
  readonly title: string
  readonly proposalId: string
  readonly ghostId: string
}): React.JSX.Element {
  const { decide, busy } = usePlanDecide()
  return (
    <span className="flex shrink-0 gap-1">
      <button
        type="button"
        className="nodrag plan-decide"
        aria-label={`Valider l’étape « ${title} »`}
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation()
          void decide({ proposalId, accept: [ghostId], reject: [] })
        }}
      >
        ✓
      </button>
      <button
        type="button"
        className="nodrag plan-decide"
        aria-label={`Refuser l’étape « ${title} »`}
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation()
          void decide({ proposalId, accept: [], reject: [ghostId] })
        }}
      >
        ✗
      </button>
    </span>
  )
}

/**
 * Gestes d'une action finale (spec 013) : lire, exécuter ou arrêter, accepter ou refuser la proposition. Mêmes
 * libellés qu'avant la refonte ; ils vivent dans la carte de détails de l'étape (spec 022, inventaire §4).
 */
export function StepFinalActions({ step }: { readonly step: StepView }): React.JSX.Element | null {
  const finals = useFinalDecide()
  const openFinal = useUiStore((state) => state.openFinal)
  const { final } = step
  if (final === undefined) return null
  return (
    <span className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        className="nodrag plan-final-badge"
        aria-label={`Lire l’action finale de « ${step.title} »`}
        onClick={(event) => {
          event.stopPropagation()
          openFinal(step.id)
        }}
      >
        <BoltIcon />
      </button>
      {final.state !== 'proposee' && step.status !== 'fait' ? (
        final.state === 'en_cours' ? (
          <button
            type="button"
            className="nodrag plan-final-run"
            aria-label={`Arrêter l’exécution de « ${step.title} »`}
            disabled={finals.busy}
            onClick={(event) => {
              event.stopPropagation()
              void finals.stop(step.id)
            }}
          >
            ■
          </button>
        ) : (
          <button
            type="button"
            className="nodrag plan-final-run"
            aria-label={`Exécuter « ${step.title} »`}
            title={
              final.projectLinked ? 'Exécuter : Claude écrit dans le projet lié' : 'Exécuter : documents seulement'
            }
            disabled={finals.busy}
            onClick={(event) => {
              event.stopPropagation()
              void finals.execute(step.id)
            }}
          >
            ▶
          </button>
        )
      ) : null}
      {final.state === 'proposee' ? (
        <>
          <button
            type="button"
            className="nodrag plan-decide plan-decide-small"
            aria-label={`Accepter « ${step.title} » comme action finale`}
            disabled={finals.busy}
            onClick={(event) => {
              event.stopPropagation()
              void finals.decide(step.id, true)
            }}
          >
            ✓
          </button>
          <button
            type="button"
            className="nodrag plan-decide plan-decide-small"
            aria-label={`Refuser l’action finale pour « ${step.title} »`}
            disabled={finals.busy}
            onClick={(event) => {
              event.stopPropagation()
              void finals.decide(step.id, false)
            }}
          >
            ✗
          </button>
        </>
      ) : null}
    </span>
  )
}

/**
 * Étape d'un plan d'attaque, ou fantôme proposé par Claude (spec 011), en **petit cercle** vivant (spec 022 D11, D17) :
 * couleur de sa grande branche, rang, pastille de statut, cadenas, éclair d'action finale, repli de ses sous-étapes.
 * Un clic ouvre sa carte de détails (gérée par la carte), qui porte les gestes de l'action finale. Fantôme : cercle en
 * pointillés, ✓ / ✗ à côté.
 */
export function PlanNode({ data }: NodeProps<PlanNodeType>): React.JSX.Element {
  const { item, dimmed, visual, open, fold } = data
  const toggleFold = usePlanFold()

  if (item.kind === 'ghost') {
    const { ghost } = item
    return (
      <div className={`nopan living-ghost${dimmed ? ' plan-dimmed' : ''}`} title={ghost.why}>
        <LivingNode id={ghost.id} title={ghost.title} visual={visual} rank={item.label} open={open}>
          <PlanHandles />
          <span className="living-ghost-actions">
            <GhostDecision title={ghost.title} proposalId={item.proposalId} ghostId={ghost.id} />
          </span>
        </LivingNode>
      </div>
    )
  }

  const { step } = item
  const { final } = step
  return (
    <div
      className={`nopan living-step plan-status-${step.status}${dimmed ? ' plan-dimmed' : ''}`}
      title={final === undefined ? undefined : `${finalStateLabel(final.state, step.status)} — ${final.deliverable}`}
    >
      <LivingNode
        id={step.id}
        title={step.title}
        visual={visual}
        rank={item.label}
        open={open}
        {...(fold === null ? {} : { fold: { ...fold, onToggle: () => void toggleFold(step.id, !fold.collapsed) } })}
      >
        <PlanHandles />
        {/* Point d'accroche visible au survol : on le tire vers un widget pour lui transmettre l'étape (spec 015). */}
        <Handle
          id="connect"
          type="source"
          position={Position.Right}
          isConnectableEnd={false}
          className="neuron-connector"
          title="Tirer vers un widget pour lui transmettre cette étape"
        />
        {step.locked ? <LockIcon className="living-lock" /> : null}
        {final === undefined ? null : (
          <span className="living-badge" title={finalStateLabel(final.state, step.status)}>
            <BoltIcon />
          </span>
        )}
      </LivingNode>
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
