import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
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

/** Réponses d'origine d'une section, sans doublon (lecture seule : ces sous-neurones sont rangés dans le document). */
function originsOf(points: readonly SourcedPointView[]): string[] {
  return [...new Set(points.flatMap((point) => point.sources.map((source) => source.title)))]
}

function Origins({ points }: { readonly points: readonly SourcedPointView[] }): React.JSX.Element | null {
  const origins = originsOf(points)
  if (origins.length === 0) return null
  return (
    <details className="text-xs text-content-muted">
      <summary className="cursor-pointer select-none hover:underline">D’où ça vient</summary>
      <ul className="mt-1 space-y-1 border-l border-content-muted/30 pl-3">
        {origins.map((origin) => (
          <li key={origin}>{origin}</li>
        ))}
      </ul>
    </details>
  )
}

/** Titre de section de la fiche : petit, espacé, avec son pictogramme (Gestalt : même style = même rôle). */
function SectionTitle({ icon, label, tone = '' }: { icon: string; label: string; tone?: string }): React.JSX.Element {
  return (
    <h3
      className={`flex items-center gap-2 text-xs font-semibold tracking-wider uppercase ${tone || 'text-content-muted'}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </h3>
  )
}

/** Un point : titre court en gras puis sa phrase ; les synthèses plus anciennes n'ont que la phrase. */
function PointText({ point }: { readonly point: SourcedPointView }): React.JSX.Element {
  return point.headline === null ? (
    <span>{point.text}</span>
  ) : (
    <span>
      <span className="font-semibold">{point.headline}</span>
      <span className="block text-content-muted">{point.text}</span>
    </span>
  )
}

function ArgumentColumn({
  points,
  label,
  icon,
  tone
}: {
  readonly points: readonly SourcedPointView[]
  readonly label: string
  readonly icon: string
  readonly tone: 'pro' | 'con'
}): React.JSX.Element {
  const color = tone === 'pro' ? 'text-pro' : 'text-con'
  const border = tone === 'pro' ? 'border-pro/40' : 'border-con/40'
  return (
    <section aria-label={label} className={`space-y-2 rounded-lg border-t-2 ${border} bg-surface p-3`}>
      <SectionTitle icon={icon} label={label} tone={color} />
      <ul className="space-y-2 leading-relaxed">
        {points.map((point, index) => (
          <li key={index}>
            <PointText point={point} />
          </li>
        ))}
      </ul>
      <Origins points={points} />
    </section>
  )
}

/**
 * Fiche éditoriale d'une idée éclose (retour de test : « trop robotique ») : « En bref », points clés numérotés,
 * pour / contre côte à côte, décisions, questions ouvertes en encadré, prochaine étape mise en avant.
 */
function ReflectionReader({ summary }: { readonly summary: Summary }): React.JSX.Element {
  const hasArguments = summary.pros.length > 0 || summary.cons.length > 0
  return (
    <div className="@container space-y-5">
      {summary.overview === null ? null : (
        <section aria-label="En bref" className="space-y-1 border-l-4 border-accent pl-3">
          <SectionTitle icon="✦" label="En bref" />
          <p className="text-[15px] leading-relaxed">{summary.overview}</p>
        </section>
      )}

      {summary.keyPoints.length === 0 ? null : (
        <section aria-label="Points clés" className="space-y-2">
          <SectionTitle icon="◆" label="Points clés" />
          <ol className="space-y-3">
            {summary.keyPoints.map((point, index) => (
              <li key={index} className="flex gap-3 leading-relaxed">
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent"
                >
                  {index + 1}
                </span>
                <PointText point={point} />
              </li>
            ))}
          </ol>
          <Origins points={summary.keyPoints} />
        </section>
      )}

      {hasArguments ? (
        <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
          {summary.pros.length === 0 ? null : (
            <ArgumentColumn points={summary.pros} label="Pour" icon="＋" tone="pro" />
          )}
          {summary.cons.length === 0 ? null : (
            <ArgumentColumn points={summary.cons} label="Contre" icon="−" tone="con" />
          )}
        </div>
      ) : null}

      {summary.decisions.length === 0 ? null : (
        <section aria-label="Décisions" className="space-y-2">
          <SectionTitle icon="✓" label="Décisions" />
          <ul className="space-y-2 leading-relaxed">
            {summary.decisions.map((point, index) => (
              <li key={index} className="flex gap-2">
                <span aria-hidden="true" className="text-pro">
                  ✓
                </span>
                <PointText point={point} />
              </li>
            ))}
          </ul>
          <Origins points={summary.decisions} />
        </section>
      )}

      {summary.openQuestions.length === 0 ? null : (
        <section
          aria-label="Questions ouvertes"
          className="space-y-2 rounded-lg border border-dashed border-content-muted/40 p-3"
        >
          <SectionTitle icon="?" label="Questions ouvertes" />
          <ul className="list-disc space-y-1 pl-5 leading-relaxed">
            {summary.openQuestions.map((question, index) => (
              <li key={index}>{question.text}</li>
            ))}
          </ul>
        </section>
      )}

      {summary.nextStep === null ? null : (
        <section aria-label="Prochaine étape" className="space-y-1 rounded-lg bg-accent/10 p-3">
          <SectionTitle icon="➜" label="Prochaine étape" tone="text-accent" />
          <p className="font-medium leading-relaxed">{summary.nextStep}</p>
        </section>
      )}
    </div>
  )
}

/** Contenu du document : plan d’action ou synthèse de réflexion. */
export function DocumentBody({ document }: { readonly document: HatchedResultView }): React.JSX.Element {
  return document.type === 'action_plan' ? (
    <ul className="space-y-2">
      {document.nodes
        .filter((node) => node.parentId === null)
        .map((node) => (
          <PlanItem key={node.id} node={node} plan={document} />
        ))}
    </ul>
  ) : (
    <ReflectionReader summary={document} />
  )
}

/** Document en cours de l'idée (éclosions précédentes), partagé par la lecture et le cycle suivant. */
export function useIdeaDocument(rootId: string): UseQueryResult<HatchedResultView | null> {
  return useQuery({
    queryKey: ['hatched', rootId],
    queryFn: () => call<HatchedResultView | null>('hatched:get', { rootId })
  })
}

interface HatchedPanelProps {
  readonly rootId: string
  /** Après « Approfondir » : lance le nouveau cycle de questions. */
  readonly onDeepened: () => void
}

/**
 * Idée éclose (FR-020, FR-021, T064) : le document se lit comme un texte propre ; ses réponses d'origine sont
 * rangées dedans (dépliables). « Approfondir » relance un cycle de questions à partir de ce document.
 */
export function HatchedPanel({ rootId, onDeepened }: HatchedPanelProps): React.JSX.Element {
  const client = useQueryClient()
  const titleId = useId()
  const result = useIdeaDocument(rootId)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const deepen = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await call('fusion:reopen', { rootId })
      await Promise.all(
        [['dive', rootId], ['canvas'], ['hatched', rootId], ['history']].map((queryKey) =>
          client.invalidateQueries({ queryKey })
        )
      )
      onDeepened()
    } catch (failure) {
      setError(failure instanceof IpcFailure ? failure.message : 'Impossible d’approfondir l’idée.')
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
        <article className="space-y-4 rounded-lg bg-surface-raised p-4">
          <DocumentBody document={data} />
        </article>
      )}
      {error === null ? null : (
        <p role="alert" className="text-xs">
          {error}
        </p>
      )}
      <div className="mt-auto space-y-2 border-t border-content-muted/20 pt-3">
        <p className="text-xs text-content-muted">
          De nouvelles questions partiront de ce document ; il restera lisible jusqu’à la prochaine éclosion.
        </p>
        <Button variant="primary" disabled={busy} onClick={() => void deepen()}>
          Approfondir
        </Button>
      </div>
    </section>
  )
}
