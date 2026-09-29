import type { CSSProperties } from 'react'
import type { NeuronKind, SuggestionView } from '@shared/ipc/neurons'
import type { IdeaTreeLayout, PlacedItem, Point } from './ideaTreeLayout'

const KIND_LABELS: Record<NeuronKind, string> = {
  root: 'idée',
  answer: 'réponse',
  condition: 'condition',
  branch: 'branche',
  opportunity: 'opportunité',
  investigation: 'à trouver',
  user_branch: 'ma branche'
}

/** Taille des éléments de l'arbre (multiples de 8) : sous-neurones, suggestions, questions « + ». */
const NODE_SIZE = 48
const SLOT_SIZE = 32

interface IdeaTreeProps {
  readonly layout: IdeaTreeLayout
  /** Centre de l'idée ouverte, en coordonnées de la carte. */
  readonly center: Point
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

function sizeOf(placed: PlacedItem): number {
  return placed.item.type === 'slot' ? SLOT_SIZE : NODE_SIZE
}

/** Départ d'un trait : le bord du cercle de l'idée, ou le centre du sous-neurone parent. */
function lineStart(placed: PlacedItem, rootSize: number): Point {
  if (!placed.fromRoot) return placed.from
  const length = Math.hypot(placed.point.x, placed.point.y) || 1
  const offset = rootSize / 2
  return { x: (placed.point.x / length) * offset, y: (placed.point.y / length) * offset }
}

/** Hostname affiché pour une source web (le lien lui-même s'ouvre dans le navigateur système). */
function domainOf(url: string): string {
  return URL.canParse(url) ? new URL(url).hostname : url
}

/**
 * Arbre de l'idée ouverte, sur la carte (FR-013 révisée) : sous-neurones reliés à leur parent, suggestions de l'IA
 * en fantômes et questions « + » autour du neurone ciblé. Un clic cible un sous-neurone ; le volet suit.
 */
export function IdeaTree(props: IdeaTreeProps): React.JSX.Element {
  const { layout, center, rootSize } = props
  const extent = layout.extent
  const style = {
    '--cat': props.categoryColor,
    left: center.x - extent,
    top: center.y - extent,
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

  return (
    <div className={`idea-tree nodrag nopan${props.fusing ? ' idea-tree-fusing' : ''}`} style={style}>
      <svg className="idea-tree-lines" width={2 * extent} height={2 * extent} aria-hidden="true">
        {layout.items.map((placed) => {
          const start = lineStart(placed, rootSize)
          const dashed = placed.item.type !== 'neuron'
          return (
            <line
              key={`line-${placed.item.id}`}
              x1={extent + start.x}
              y1={extent + start.y}
              x2={extent + placed.point.x}
              y2={extent + placed.point.y}
              className={dashed ? 'dive-line dive-line-dashed' : 'dive-line'}
            />
          )
        })}
      </svg>
      {layout.items.map((placed) => {
        const { item } = placed
        const box = at(placed.point, sizeOf(placed))
        switch (item.type) {
          case 'neuron':
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
 * Neurone fantôme (FR-027) : suggestion de l'IA en pointillés ; Entrée/clic = accepter, Échap/× = ignorer.
 * Une vérification web en cours est signalée ; ses sources apparaissent au survol ou au focus.
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
        aria-label={`Suggestion de l’IA : ${suggestion.title}${research}. Entrée pour l’accepter, Échap pour l’ignorer`}
        title={suggestion.content}
        className="dive-node dive-node-ghost h-full w-full"
      >
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
        <ul className="dive-sources">
          {suggestion.sources.map((source) => (
            <li key={source.url}>
              {/* Ouvert dans le navigateur système (https uniquement, filtré par le processus principal). */}
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title} <span className="text-content-muted">— {domainOf(source.url)}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
