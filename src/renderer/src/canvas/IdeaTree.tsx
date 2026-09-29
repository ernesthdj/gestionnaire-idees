import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { NeuronKind, SuggestionView, WebSourceView } from '@shared/ipc/neurons'
import type { IdeaTreeLayout, PlacedItem, Point } from './ideaTreeLayout'
import { useSpringFollow } from './useSpringFollow'

const KIND_LABELS: Record<NeuronKind, string> = {
  root: 'idée',
  answer: 'réponse',
  condition: 'condition',
  branch: 'branche',
  opportunity: 'opportunité',
  investigation: 'à trouver',
  user_branch: 'ma branche',
  idea: 'idée suggérée'
}

/** Taille des éléments de l'arbre (multiples de 8) : sous-neurones, idées suggérées, questions « + ». */
const NODE_SIZE = 48
const IDEA_SIZE = 56
const SLOT_SIZE = 32

interface IdeaTreeProps {
  readonly layout: IdeaTreeLayout
  /** Centre de l'idée ouverte, en coordonnées de la carte (suivi en direct pendant un glisser). */
  readonly center: Point
  /** Animations réduites : l'arbre suit l'idée sans ressort. */
  readonly reduced: boolean
  /** Diamètre du cercle de l'idée : les traits partent de son bord. */
  readonly rootSize: number
  readonly categoryColor: string
  readonly focusId: string
  readonly selectedExtensionId: string | null
  /** Éclosion en cours : tout se résorbe vers l'idée. */
  readonly fusing: boolean
  readonly onFocus: (neuronId: string) => void
  readonly onSelectExtension: (extensionId: string) => void
  readonly onAcceptSuggestion: (suggestionId: string) => void
  readonly onDismissSuggestion: (suggestionId: string) => void
}

/** Une idée (suggérée ou acceptée) : forme propre, texte sur son lien, fiche au double-clic. */
function isIdea(placed: PlacedItem): boolean {
  return placed.item.type === 'ghost' || (placed.item.type === 'neuron' && placed.item.kind === 'idea')
}

function sizeOf(placed: PlacedItem): number {
  if (placed.item.type === 'slot') return SLOT_SIZE
  return isIdea(placed) ? IDEA_SIZE : NODE_SIZE
}

/** Texte complet d'une idée (conseils), affiché sur le lien qui mène à elle. */
function noteOf(placed: PlacedItem): string | null {
  const { item } = placed
  if (item.type === 'ghost') return item.suggestion.content
  if (item.type === 'neuron' && item.kind === 'idea') return item.content
  return null
}

/**
 * Départ d'un trait : le centre du sous-neurone parent, ou le bord du cercle de l'idée à sa position réelle
 * (`root`, relative à l'arbre) — le trait reste accroché à l'idée pendant que l'arbre la rattrape.
 */
function lineStart(placed: PlacedItem, rootSize: number, root: Point): Point {
  if (!placed.fromRoot) return placed.from
  const dx = placed.point.x - root.x
  const dy = placed.point.y - root.y
  const length = Math.hypot(dx, dy) || 1
  const offset = rootSize / 2
  return { x: root.x + (dx / length) * offset, y: root.y + (dy / length) * offset }
}

/** Hostname affiché pour une source web (le lien lui-même s'ouvre dans le navigateur système). */
function domainOf(url: string): string {
  return URL.canParse(url) ? new URL(url).hostname : url
}

function Sources({ sources }: { readonly sources: readonly WebSourceView[] }): React.JSX.Element | null {
  if (sources.length === 0) return null
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {sources.map((source) => (
        <li key={source.url}>
          {/* Ouvert dans le navigateur système (https uniquement, filtré par le processus principal). */}
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">
            {source.title} <span className="text-content-muted">— {domainOf(source.url)}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * Arbre de l'idée ouverte, sur la carte (FR-013 révisée) : sous-neurones reliés à leur parent, idées suggérées par
 * l'IA (losanges, leur texte posé sur le lien), questions « + » autour du neurone ciblé. Un clic cible un
 * sous-neurone ; le volet suit. Double-clic sur une idée : sa fiche (conseils, sources) s'ouvre sur la carte.
 */
export function IdeaTree(props: IdeaTreeProps): React.JSX.Element {
  const { layout, center, rootSize } = props
  const extent = layout.extent
  // L'arbre suit son idée avec un ressort (effet flottant) quand on la déplace.
  const anchor = useSpringFollow(center, !props.reduced)
  const root = { x: center.x - anchor.x, y: center.y - anchor.y }
  /** Fiche ouverte (double-clic sur une idée acceptée). */
  const [docId, setDocId] = useState<string | null>(null)
  /** Textes d'idées dépliés en entier. */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const style = {
    '--cat': props.categoryColor,
    left: anchor.x - extent,
    top: anchor.y - extent,
    width: 2 * extent,
    height: 2 * extent
  } as CSSProperties
  const at = (point: Point, size: number): CSSProperties =>
    ({
      left: extent + point.x - size / 2,
      top: extent + point.y - size / 2,
      width: size,
      height: size,
      '--dx': `${-point.x}px`,
      '--dy': `${-point.y}px`
    }) as CSSProperties

  const doc = layout.items.find((placed) => placed.item.id === docId)
  const toggle = (id: string): void =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className={`idea-tree nodrag nopan${props.fusing ? ' idea-tree-fusing' : ''}`} style={style}>
      <svg className="idea-tree-lines" width={2 * extent} height={2 * extent} aria-hidden="true">
        {layout.items.map((placed) => {
          const start = lineStart(placed, rootSize, root)
          const dashed = placed.item.type !== 'neuron'
          return (
            <line
              key={`line-${placed.item.id}`}
              x1={extent + start.x}
              y1={extent + start.y}
              x2={extent + placed.point.x}
              y2={extent + placed.point.y}
              className={`dive-line${dashed ? ' dive-line-dashed' : ''}${isIdea(placed) ? ' idea-line' : ''}`}
            />
          )
        })}
      </svg>

      {/* Texte des idées posé sur leur lien : il contextualise l'idée et reste une fois l'idée acceptée. */}
      {layout.items.map((placed) => {
        const note = noteOf(placed)
        if (note === null || note === '') return null
        const start = lineStart(placed, rootSize, root)
        const middle = { x: (start.x + placed.point.x) / 2, y: (start.y + placed.point.y) / 2 }
        const open = expanded.has(placed.item.id)
        return (
          <button
            key={`note-${placed.item.id}`}
            type="button"
            onClick={() => toggle(placed.item.id)}
            aria-expanded={open}
            aria-label={`Texte de l’idée : ${note}`}
            className={`idea-tree-item idea-note${open ? ' idea-note-open' : ''}`}
            style={
              {
                left: extent + middle.x,
                top: extent + middle.y,
                '--dx': `${-middle.x}px`,
                '--dy': `${-middle.y}px`
              } as CSSProperties
            }
          >
            {note}
          </button>
        )
      })}

      {layout.items.map((placed) => {
        const { item } = placed
        const box = at(placed.point, sizeOf(placed))
        switch (item.type) {
          case 'neuron':
            if (item.kind === 'idea') {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => props.onFocus(item.id)}
                  onDoubleClick={() => setDocId(item.id)}
                  aria-label={`Idée suggérée : ${item.title}${item.descendants > 0 ? `, ${item.descendants} sous-neurones` : ''}. Double-clic pour lire sa fiche`}
                  aria-pressed={props.focusId === item.id}
                  className={`idea-tree-item idea-gem${props.focusId === item.id ? ' idea-gem-focus' : ''}`}
                  style={box}
                >
                  <span aria-hidden="true" className="idea-gem-glyph">
                    ✦
                  </span>
                  <span className="dive-title">{item.title}</span>
                </button>
              )
            }
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => props.onFocus(item.id)}
                aria-label={`${KIND_LABELS[item.kind]} : ${item.title}${item.origin === 'ai' ? ' (proposé par l’IA)' : ''}${item.descendants > 0 ? `, ${item.descendants} sous-neurones` : ''}`}
                aria-pressed={props.focusId === item.id}
                className={`idea-tree-item dive-node dive-node-child${item.kind === 'investigation' ? ' dive-node-investigation' : ''}${props.focusId === item.id ? ' dive-node-focus' : ''}`}
                style={box}
              >
                {item.origin === 'ai' ? (
                  <span aria-hidden="true" className="dive-badge">
                    ✦
                  </span>
                ) : null}
                <span className="dive-title">{item.title}</span>
              </button>
            )
          case 'pending':
            return (
              <div
                key={item.id}
                role="status"
                aria-label={`Nouveau sous-neurone : ${item.title}`}
                className="idea-tree-item dive-node dive-node-child dive-node-pending"
                style={box}
              >
                <span className="dive-title">{item.title}</span>
              </div>
            )
          case 'ghost':
            return (
              <Ghost
                key={item.id}
                suggestion={item.suggestion}
                style={box}
                onAccept={() => props.onAcceptSuggestion(item.suggestion.id)}
                onDismiss={() => props.onDismissSuggestion(item.suggestion.id)}
              />
            )
          case 'slot':
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => props.onSelectExtension(item.extension.id)}
                aria-label={`Question : ${item.extension.question}`}
                aria-pressed={props.selectedExtensionId === item.extension.id}
                title={item.extension.question}
                className="idea-tree-item dive-slot"
                style={box}
              >
                +
              </button>
            )
        }
      })}

      {doc === undefined || doc.item.type !== 'neuron' ? null : (
        <IdeaDoc
          title={doc.item.title}
          content={doc.item.content}
          sources={doc.item.sources}
          style={{ left: extent + doc.point.x + IDEA_SIZE / 2 + 16, top: extent + doc.point.y - IDEA_SIZE / 2 }}
          onClose={() => setDocId(null)}
        />
      )}
    </div>
  )
}

interface IdeaDocProps {
  readonly title: string
  readonly content: string | null
  readonly sources: readonly WebSourceView[]
  readonly style: CSSProperties
  readonly onClose: () => void
}

/** Fiche d'une idée, posée sur la carte à côté d'elle : conseils complets et sources. `Échap` ou × referme. */
function IdeaDoc({ title, content, sources, style, onClose }: IdeaDocProps): React.JSX.Element {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => panel.current?.focus(), [])
  return (
    <div
      ref={panel}
      role="dialog"
      aria-label={`Fiche de l’idée : ${title}`}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
      className="idea-doc"
      style={style}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">
          <span aria-hidden="true" className="idea-doc-glyph">
            ✦{' '}
          </span>
          {title}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la fiche"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-surface-raised"
        >
          ×
        </button>
      </div>
      <p className="mt-2 whitespace-pre-line text-content">{content ?? 'Pas encore de conseils pour cette idée.'}</p>
      <Sources sources={sources} />
    </div>
  )
}

interface GhostProps {
  readonly suggestion: SuggestionView
  readonly style: CSSProperties
  readonly onAccept: () => void
  readonly onDismiss: () => void
}

/**
 * Idée suggérée par l'IA, pas encore acceptée (FR-027) : losange en pointillés qui respire, une étincelle en orbite.
 * Entrée/clic = accepter, Échap/× = ignorer. Une vérification web en cours est signalée ; ses sources au survol.
 */
function Ghost({ suggestion, style, onAccept, onDismiss }: GhostProps): React.JSX.Element {
  const research =
    suggestion.research === 'pending'
      ? ', vérification web en cours'
      : suggestion.research === 'done'
        ? ', vérifiée sur le web'
        : ''
  return (
    <div className="idea-tree-item dive-ghost-wrap" style={style}>
      <button
        type="button"
        onClick={onAccept}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onDismiss()
          }
        }}
        aria-label={`Idée suggérée par l’IA : ${suggestion.title}${research}. Entrée pour l’accepter, Échap pour l’ignorer`}
        className="idea-gem idea-gem-ghost h-full w-full"
      >
        <span aria-hidden="true" className="idea-orbit" />
        <span className="dive-title">{suggestion.title}</span>
        {suggestion.research === 'pending' ? (
          <span aria-hidden="true" className="dive-research">
            ⟳
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Ignorer la suggestion : ${suggestion.title}`}
        className="dive-ghost-dismiss"
      >
        ×
      </button>
      {suggestion.sources.length > 0 ? (
        <div className="dive-sources">
          <Sources sources={suggestion.sources} />
        </div>
      ) : null}
    </div>
  )
}
