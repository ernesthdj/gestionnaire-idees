import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useState } from 'react'
import type { WorkflowFileSummaryView } from '@shared/ipc/workflow'
import { call, IpcFailure } from '../../lib/ipc'
import { BOX_HEIGHT, flowLayout, flowMermaid, LABEL_HEIGHT } from './flowDiagram'

/**
 * Petit schéma de l'explication (spec 023 D15, précisé) : dessiné par l'app à partir des liens validés (aucun texte de
 * l'IA n'est interprété) ; un clic sur un morceau surligne son code ; « Copier en Mermaid » donne le même schéma en
 * texte, pour des notes. Les morceaux restent atteignables au clavier par la liste ; le dessin est décrit en texte.
 */
function FlowDiagram({
  summary,
  onPart
}: {
  readonly summary: WorkflowFileSummaryView
  readonly onPart: (lines: { readonly from: number; readonly to: number }) => void
}): React.JSX.Element | null {
  const layout = useMemo(() => flowLayout(summary), [summary])
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])
  const markerId = `flow-arrow-${useId().replace(/:/g, '')}`
  if (layout.boxes.length === 0) return null
  const partOf = (id: string) => summary.parts.find((part) => part.name === id)
  const described = summary.flow.map((arrow) => {
    const name = (id: string): string => (id === 'in' ? 'l’entrée' : id === 'out' ? 'la sortie' : id)
    return `${name(arrow.from)} ${arrow.label} ${name(arrow.to)}`
  })
  return (
    <figure className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <figcaption className="flex-1 text-xs font-semibold text-content-muted">
          Comment ça marche
          <span className="sr-only"> : {described.join(' ; ')}.</span>
        </figcaption>
        <button
          type="button"
          className="card-button card-button-ghost"
          onClick={() => void navigator.clipboard?.writeText(flowMermaid(summary)).then(() => setCopied(true))}
        >
          {copied ? 'Copié ✓' : 'Copier en Mermaid'}
        </button>
      </div>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        // Taille naturelle, réduite seulement si la colonne est plus étroite : jamais agrandi (D17).
        width={layout.width}
        height={layout.height}
        className="h-auto max-w-full self-center"
      >
        <defs>
          <marker id={markerId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="var(--color-content-muted)" />
          </marker>
        </defs>
        {layout.arrows.map((arrow) => (
          <g key={`${arrow.from}>${arrow.to}`}>
            <path
              d={arrow.path}
              fill="none"
              stroke="var(--color-content-muted)"
              strokeWidth={1.5}
              markerEnd={`url(#${markerId})`}
            />
            <title>{arrow.label}</title>
            <rect
              x={arrow.labelX - arrow.labelWidth / 2}
              y={arrow.labelY - LABEL_HEIGHT / 2}
              width={arrow.labelWidth}
              height={LABEL_HEIGHT}
              rx={LABEL_HEIGHT / 2}
              fill="var(--color-surface-raised)"
              stroke="var(--color-content-muted)"
              strokeOpacity={0.35}
            />
            <text x={arrow.labelX} y={arrow.labelY + 4} textAnchor="middle" fontSize={11} fill="var(--color-content)">
              {arrow.text}
            </text>
          </g>
        ))}
        {layout.boxes.map((box) => {
          const part = box.kind === 'part' ? partOf(box.id) : undefined
          return (
            <g
              key={box.id}
              className={part === undefined ? undefined : 'cursor-pointer'}
              onClick={part === undefined ? undefined : () => onPart({ from: part.startLine, to: part.endLine })}
            >
              <title>
                {box.kind === 'in' ? summary.receives : box.kind === 'out' ? summary.produces : (part?.why ?? '')}
              </title>
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={BOX_HEIGHT}
                rx={box.kind === 'part' ? 6 : BOX_HEIGHT / 2}
                fill={box.kind === 'part' ? 'var(--color-surface)' : 'var(--color-surface-raised)'}
                stroke={box.kind === 'part' ? 'var(--color-accent)' : 'var(--color-content-muted)'}
                strokeWidth={box.kind === 'part' ? 2 : 1.5}
                strokeDasharray={box.kind === 'part' ? undefined : '4 3'}
              />
              <text
                x={box.x + box.width / 2}
                y={box.y + BOX_HEIGHT / 2 + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                fontFamily={box.kind === 'part' ? 'var(--font-mono, monospace)' : undefined}
                fill="var(--color-content)"
              >
                {box.label.length > 30 ? `${box.label.slice(0, 29)}…` : box.label}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/**
 * « Que fait ce fichier ? » (spec 023 D15) : l'explication rédigée à la demande — rôle, ce qu'il reçoit, ce qu'il
 * produit, et ses morceaux importants dans l'ordre de lecture ; un clic sur un morceau surligne son code. Texte
 * seulement, jamais de HTML. Gardée tant que le fichier ne change pas (le main la garde en mémoire).
 */
export function FileExplanation({
  genesisId,
  path,
  onPart,
  onHide
}: {
  readonly genesisId: string
  readonly path: string
  readonly onPart: (lines: { readonly from: number; readonly to: number }) => void
  readonly onHide: () => void
}): React.JSX.Element {
  const titleId = useId()
  const query = useQuery({
    queryKey: ['workflow', genesisId, 'summary', path],
    queryFn: () => call<WorkflowFileSummaryView>('workflow:summary', { genesisId, path }),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false
  })
  const summary = query.data
  return (
    <section
      aria-labelledby={titleId}
      aria-busy={query.isFetching}
      className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-lg border border-accent/40 bg-surface-raised p-3 text-sm"
    >
      <div className="flex items-start gap-2">
        <h4 id={titleId} className="flex-1 font-semibold">
          <span aria-hidden="true">✨ </span>Que fait ce fichier ?
        </h4>
        <button type="button" className="card-button card-button-ghost" onClick={onHide}>
          Masquer
        </button>
      </div>
      {query.error !== null ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-con">
            {query.error instanceof IpcFailure ? query.error.message : 'L’explication n’a pas pu être rédigée.'}
          </p>
          <button type="button" className="card-button" onClick={() => void query.refetch()}>
            Réessayer
          </button>
        </div>
      ) : summary === undefined ? (
        <p className="text-content-muted" role="status">
          Lecture du fichier par l’IA… quelques secondes.
        </p>
      ) : (
        <>
          <p className="text-[15px] leading-snug">{summary.role}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="font-semibold text-content-muted">Reçoit</dt>
            <dd>{summary.receives}</dd>
            <dt className="font-semibold text-content-muted">Produit</dt>
            <dd>{summary.produces}</dd>
          </dl>
          <FlowDiagram summary={summary} onPart={onPart} />
          {summary.parts.length === 0 ? null : (
            <>
              <h5 className="mt-1 text-xs font-semibold text-content-muted">Les morceaux importants, dans l’ordre</h5>
              <ol className="flex flex-col gap-1">
                {summary.parts.map((part, index) => (
                  <li key={part.name} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-surface"
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <button
                        type="button"
                        className="rounded font-mono font-semibold text-accent underline decoration-dotted hover:bg-surface"
                        title={`Voir son code (lignes ${part.startLine} à ${part.endLine})`}
                        onClick={() => onPart({ from: part.startLine, to: part.endLine })}
                      >
                        {part.name}
                      </button>{' '}
                      → {part.why}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
          <p className="text-xs text-content-muted">
            Expliqué par {summary.engine === 'claude' ? 'Claude' : 'l’IA locale'} ({summary.model}) à partir du code :
            une aide à la lecture, à vérifier dans le code.
          </p>
        </>
      )}
    </section>
  )
}
