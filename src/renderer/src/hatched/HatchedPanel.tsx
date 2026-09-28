import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { HatchedResultView, PlanDependencyView, PlanNodeView, SourcedPointView } from '@shared/ipc/neurons'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { formatEuros } from '../pages/settings/ai/format'

type Plan = Extract<HatchedResultView, { type: 'action_plan' }>
type Summary = Extract<HatchedResultView, { type: 'reflection_summary' }>

const STATUS_LABELS: Record<PlanNodeView['status'], string> = {
  blocked: 'Bloquée',
  ready: 'À faire',
  in_progress: 'En cours',
  done: 'Faite',
  abandoned: 'Abandonnée'
}
const ICONS: Record<PlanNodeView['type'], string> = { task: '☐', condition: '◆', opportunity: '✦' }
const TYPE_LABELS: Record<PlanNodeView['type'], string> = {
  task: 'Tâche',
  condition: 'Condition',
  opportunity: 'Opportunité'
}

function waitsFor(node: PlanNodeView, plan: Plan): string[] {
  return plan.dependencies
    .filter((dependency: PlanDependencyView) => dependency.toNodeId === node.id)
    .map((dependency) => {
      if (dependency.kind === 'on_trigger') {
        const reached = dependency.triggerReachedAt === null ? 'pas encore' : 'atteint ✓'
        return `quand : ${dependency.triggerLabel ?? 'déclencheur'} (${reached})`
      }
      const from = plan.nodes.find((entry) => entry.id === dependency.fromNodeId)
      return `après « ${from?.title ?? '…'} »`
    })
}

function PlanItem({ node, plan }: { readonly node: PlanNodeView; readonly plan: Plan }): React.JSX.Element {
  const children = plan.nodes.filter((child) => child.parentId === node.id)
  const inactive = node.branchLabel !== null && !node.activeBranch
  const waiting = waitsFor(node, plan)
  return (
    <li className={`space-y-1 ${inactive ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={node.status === 'done' || node.status === 'abandoned' ? 'line-through' : ''}>
          <span aria-hidden="true" className="mr-1">
            {node.type === 'task' && node.status === 'done' ? '☑' : ICONS[node.type]}
          </span>
          <span className="sr-only">{TYPE_LABELS[node.type]} : </span>
          {node.branchLabel === null ? null : <span className="font-semibold">{node.branchLabel} → </span>}
          {node.title}
          {node.question === null ? null : <span className="text-content-muted"> ({node.question})</span>}
          {node.amountCents === null ? null : (
            <span className="ml-1 text-content-muted">· {formatEuros(node.amountCents)}</span>
          )}
          {node.dueDate === null ? null : <span className="ml-1 text-content-muted">· {node.dueDate}</span>}
          {node.investigation ? <span className="ml-1 text-xs">· à trouver</span> : null}
          {inactive ? <span className="ml-1 text-xs">· branche écartée</span> : null}
        </p>
        {node.type === 'condition' ? null : (
          <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs">{STATUS_LABELS[node.status]}</span>
        )}
      </div>
      {waiting.length > 0 ? <p className="text-xs text-content-muted">{waiting.join(' · ')}</p> : null}
      {children.length > 0 ? (
        <ul className="ml-4 space-y-2 border-l border-content-muted/30 pl-3">
          {children.map((child) => (
            <PlanItem key={child.id} node={child} plan={plan} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

const SECTIONS = [
  ['keyPoints', 'Points clés'],
  ['decisions', 'Décisions'],
  ['pros', 'Pour'],
  ['cons', 'Contre']
] as const

function Point({
  point,
  onOpenSource
}: {
  readonly point: SourcedPointView
  readonly onOpenSource: (id: string) => void
}): React.JSX.Element {
  return (
    <li className="space-y-1">
      <p>{point.text}</p>
      {point.sources.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {point.sources.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => onOpenSource(source.id)}
              aria-label={`Voir la source : ${source.title}`}
              className="rounded-full bg-surface px-2 py-0.5 text-xs text-content-muted hover:underline"
            >
              ↳ {source.title}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  )
}

function ReflectionReader({
  summary,
  onOpenSource
}: {
  readonly summary: Summary
  readonly onOpenSource: (id: string) => void
}): React.JSX.Element {
  return (
    <>
      {SECTIONS.map(([section, label]) =>
        summary[section].length === 0 ? null : (
          <section key={section} aria-label={label} className="space-y-1">
            <h3 className="text-xs font-semibold text-content-muted">{label}</h3>
            <ul className="space-y-2">
              {summary[section].map((point, index) => (
                <Point key={index} point={point} onOpenSource={onOpenSource} />
              ))}
            </ul>
          </section>
        )
      )}
      {summary.openQuestions.length > 0 ? (
        <section aria-label="Questions ouvertes" className="space-y-1">
          <h3 className="text-xs font-semibold text-content-muted">Questions ouvertes</h3>
          <ul className="list-disc space-y-1 pl-5">
            {summary.openQuestions.map((question, index) => (
              <li key={index}>{question.text}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}

interface HatchedPanelProps {
  readonly rootId: string
  readonly onOpenSource: (neuronId: string) => void
}

/**
 * Idée éclose (FR-020, FR-021, FR-022) : lecture du plan d'action ou de la synthèse de réflexion, accès aux
 * sous-neurones sources, réouverture (retour en développement).
 */
export function HatchedPanel({ rootId, onOpenSource }: HatchedPanelProps): React.JSX.Element {
  const client = useQueryClient()
  const titleId = useId()
  const result = useQuery({
    queryKey: ['hatched', rootId],
    queryFn: () => call<HatchedResultView | null>('hatched:get', { rootId })
  })
  const [confirmReopen, setConfirmReopen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reopen = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await call('fusion:reopen', { rootId })
      await Promise.all(
        [['dive', rootId], ['canvas'], ['hatched', rootId], ['history'], ['synthesis', rootId]].map((queryKey) =>
          client.invalidateQueries({ queryKey })
        )
      )
    } catch (failure) {
      setError(failure instanceof IpcFailure ? failure.message : 'La réouverture a échoué.')
    } finally {
      setBusy(false)
    }
  }

  const data = result.data
  return (
    <section aria-labelledby={titleId} className="flex h-full flex-col gap-3 overflow-auto p-4 text-sm">
      <h2 id={titleId} className="text-base font-semibold">
        {data?.type === 'reflection_summary' ? 'Synthèse de l’idée éclose' : 'Plan de l’idée éclose'}
      </h2>
      {result.isPending ? (
        <p role="status" className="text-content-muted">
          Chargement…
        </p>
      ) : data === null || data === undefined ? (
        <p className="text-content-muted">Aucun plan ni synthèse en cours pour cette idée.</p>
      ) : (
        <div className="space-y-3 rounded-lg bg-surface-raised p-4">
          {data.type === 'action_plan' ? (
            <ul className="space-y-2">
              {data.nodes
                .filter((node) => node.parentId === null)
                .map((node) => (
                  <PlanItem key={node.id} node={node} plan={data} />
                ))}
            </ul>
          ) : (
            <ReflectionReader summary={data} onOpenSource={onOpenSource} />
          )}
        </div>
      )}
      {error === null ? null : (
        <p role="alert" className="text-xs">
          {error}
        </p>
      )}
      <div className="mt-auto space-y-2 border-t border-content-muted/20 pt-3">
        {confirmReopen ? (
          <>
            <p className="text-xs">
              L’idée repart en développement : tu pourras la compléter puis la refaire éclore. Le plan ou la synthèse
              actuels ne seront plus « en cours ».
            </p>
            <div className="flex gap-2">
              <Button variant="primary" disabled={busy} onClick={() => void reopen()}>
                Confirmer la réouverture
              </Button>
              <Button onClick={() => setConfirmReopen(false)}>Annuler</Button>
            </div>
          </>
        ) : (
          <Button onClick={() => setConfirmReopen(true)}>Rouvrir l’idée</Button>
        )}
      </div>
    </section>
  )
}
