import { motion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { ExtensionView, NeuronKind, SuggestionView } from '@shared/ipc/neurons'
import { timingFor } from '../motion/durations'
import type { DiveModel, DiveNeuron } from './diveModel'
import { radialLayout, type Point } from './radialLayout'
import type { PendingChild } from './useDive'

const KIND_LABELS: Record<NeuronKind, string> = {
  root: 'idée',
  answer: 'réponse',
  condition: 'condition',
  branch: 'branche',
  opportunity: 'opportunité',
  investigation: 'à trouver',
  user_branch: 'ma branche'
}

/** Placement absolu d'un élément (compatible avec les styles React et Motion). */
interface Box {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

type Item =
  | { readonly type: 'child'; readonly neuron: DiveNeuron }
  | { readonly type: 'pending'; readonly pending: PendingChild }
  | { readonly type: 'ghost'; readonly suggestion: SuggestionView }
  | { readonly type: 'slot'; readonly extension: ExtensionView }

interface DiveStageProps {
  readonly model: DiveModel
  readonly pending: readonly PendingChild[]
  readonly reduced: boolean
  /** Confirmation en cours : tout se résorbe vers le neurone central, qui prend l'aspect éclos. */
  readonly fusing: boolean
  readonly categoryColor: string
  readonly selectedExtensionId: string | null
  readonly onOpen: (neuronId: string) => void
  readonly onUp: () => void
  readonly onSelectExtension: (extensionId: string) => void
  readonly onAcceptSuggestion: (suggestionId: string) => void
  readonly onDismissSuggestion: (suggestionId: string) => void
}

/** Échelle pour que toute la couronne tienne dans la scène (jamais agrandie au-delà de 1). */
function useFitScale(extent: number): [React.RefObject<HTMLDivElement | null>, number] {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const element = box.current
    if (element === null) return
    const update = (): void => {
      const size = Math.min(element.clientWidth, element.clientHeight)
      setScale(size > 0 ? Math.min(1, size / (2 * extent)) : 1)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [extent])
  return [box, scale]
}

/** Hostname affiché pour une source web (le lien lui-même s'ouvre dans le navigateur système). */
function domainOf(url: string): string {
  return URL.canParse(url) ? new URL(url).hostname : url
}

/**
 * Scène de la plongée (FR-013, FR-015, FR-027) : neurone centré, sous-neurones et emplacements « + » en couronne,
 * suggestions de l'IA en fantômes, parent estompé à gauche pour remonter.
 */
export function DiveStage(props: DiveStageProps): React.JSX.Element {
  const { model, pending, reduced } = props
  const items: Item[] = [
    ...model.children.map((neuron): Item => ({ type: 'child', neuron })),
    ...pending.map((entry): Item => ({ type: 'pending', pending: entry })),
    ...model.suggestions.map((suggestion): Item => ({ type: 'ghost', suggestion })),
    ...model.extensions.map((extension): Item => ({ type: 'slot', extension }))
  ]
  const layout = radialLayout(items.length, model.parent !== null)
  const [box, scale] = useFitScale(layout.radius + 96)
  const grow = timingFor('grow', reduced)
  const ghostIn = timingFor('suggestion', reduced)
  const dive = timingFor('dive', reduced)
  const cat = { '--cat': props.categoryColor } as CSSProperties
  // Après chaque déplacement, le focus clavier va au neurone ciblé (l'élément cliqué a pu disparaître).
  const focusNode = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    focusNode.current?.focus()
  }, [model.focus.id])

  const fusion = timingFor('fusion', reduced)
  const hatchTiming = timingFor('migrate', reduced)
  /** Apparition (pousse) ; pendant la fusion, l'élément glisse vers le centre et s'efface. */
  const appear = (timing: { duration: number; movement: boolean }, point?: Point) =>
    props.fusing && point !== undefined
      ? {
          initial: false as const,
          animate: fusion.movement ? { opacity: 0, scale: 0.2, x: -point.x, y: -point.y } : { opacity: 0 },
          transition: { duration: fusion.duration / 1000, ease: 'easeIn' as const }
        }
      : {
          initial: timing.movement ? { opacity: 0, scale: 0.6 } : { opacity: 0 },
          animate: { opacity: 1, scale: 1 },
          transition: { duration: timing.duration / 1000 }
        }

  const at = (point: Point, size: number): Box => ({
    left: point.x - size / 2,
    top: point.y - size / 2,
    width: size,
    height: size
  })

  return (
    <div ref={box} className="relative h-full w-full overflow-hidden" style={cat}>
      <motion.div
        key={model.focus.id}
        className="absolute top-1/2 left-1/2"
        style={{ scale }}
        initial={dive.movement ? { opacity: 0, scale: scale * 0.85 } : { opacity: 0 }}
        animate={{ opacity: 1, scale }}
        transition={{ duration: dive.duration / 1000 }}
      >
        <svg
          className={`pointer-events-none absolute overflow-visible transition-opacity ${props.fusing ? 'opacity-0' : ''}`}
          aria-hidden="true"
          style={{ left: 0, top: 0, transitionDuration: `${fusion.duration}ms` }}
        >
          {layout.parent === null ? null : (
            <line x1={0} y1={0} x2={layout.parent.x} y2={0} className="dive-line dive-line-faded" />
          )}
          {items.map((item, index) => {
            const point = layout.items[index] as Point
            const dashed = item.type !== 'child'
            return (
              <line
                key={`${item.type}-${index}`}
                x1={0}
                y1={0}
                x2={point.x}
                y2={point.y}
                className={dashed ? 'dive-line dive-line-dashed' : 'dive-line'}
              />
            )
          })}
        </svg>

        {props.fusing || model.parent === null || layout.parent === null ? null : (
          <button
            type="button"
            onClick={props.onUp}
            aria-label={`Remonter vers ${model.parent.title}`}
            className="dive-node dive-node-parent absolute"
            style={at(layout.parent, 64)}
          >
            <span className="dive-title">{model.parent.title}</span>
          </button>
        )}

        <motion.div
          ref={focusNode}
          tabIndex={-1}
          aria-label={props.fusing ? `${model.focus.title} éclôt` : `Neurone ciblé : ${model.focus.title}`}
          className={`dive-node dive-node-focus absolute ${props.fusing ? 'dive-node-hatched' : ''}`}
          style={at({ x: 0, y: 0 }, 112)}
          animate={props.fusing && hatchTiming.movement ? { scale: [1, 1.15, 1] } : { scale: 1 }}
          transition={{ delay: fusion.duration / 1000, duration: hatchTiming.duration / 1000 }}
        >
          <span className="dive-title dive-title-focus">{model.focus.title}</span>
        </motion.div>

        {items.map((item, index) => {
          const point = layout.items[index] as Point
          switch (item.type) {
            case 'child':
              return (
                <motion.button
                  key={item.neuron.id}
                  type="button"
                  {...appear(grow, point)}
                  onClick={() => props.onOpen(item.neuron.id)}
                  aria-label={`${KIND_LABELS[item.neuron.kind]} : ${item.neuron.title}${item.neuron.origin === 'ai' ? ' (proposé par l’IA)' : ''}${item.neuron.descendants > 0 ? `, ${item.neuron.descendants} sous-neurones` : ''} — plonger`}
                  className={`dive-node dive-node-child absolute ${item.neuron.kind === 'investigation' ? 'dive-node-investigation' : ''}`}
                  style={at(point, 72)}
                >
                  {item.neuron.origin === 'ai' ? (
                    <span aria-hidden="true" className="dive-badge">
                      ✦
                    </span>
                  ) : null}
                  <span className="dive-title">{item.neuron.title}</span>
                </motion.button>
              )
            case 'pending':
              return (
                <motion.div
                  key={`pending-${item.pending.extensionId}`}
                  {...appear(grow, point)}
                  role="status"
                  aria-label={`Nouveau sous-neurone : ${item.pending.title}`}
                  className="dive-node dive-node-child dive-node-pending absolute"
                  style={at(point, 72)}
                >
                  <span className="dive-title">{item.pending.title}</span>
                </motion.div>
              )
            case 'ghost':
              return (
                <Ghost
                  key={item.suggestion.id}
                  suggestion={item.suggestion}
                  style={at(point, 72)}
                  motionProps={appear(ghostIn, point)}
                  onAccept={() => props.onAcceptSuggestion(item.suggestion.id)}
                  onDismiss={() => props.onDismissSuggestion(item.suggestion.id)}
                />
              )
            case 'slot':
              return (
                <motion.button
                  key={item.extension.id}
                  type="button"
                  {...appear(ghostIn, point)}
                  onClick={() => props.onSelectExtension(item.extension.id)}
                  aria-label={`Question : ${item.extension.question}`}
                  aria-pressed={props.selectedExtensionId === item.extension.id}
                  className="dive-slot absolute"
                  style={at(point, 44)}
                >
                  +
                </motion.button>
              )
          }
        })}
      </motion.div>
    </div>
  )
}

interface GhostProps {
  readonly suggestion: SuggestionView
  readonly style: Box
  readonly motionProps: object
  readonly onAccept: () => void
  readonly onDismiss: () => void
}

/**
 * Neurone fantôme (FR-027) : suggestion de l'IA en pointillés ; Entrée/clic = accepter, Échap/× = ignorer.
 * Une vérification web en cours est signalée ; ses sources apparaissent au survol ou au focus.
 */
function Ghost({ suggestion, style, motionProps, onAccept, onDismiss }: GhostProps): React.JSX.Element {
  const research =
    suggestion.research === 'pending'
      ? ', vérification web en cours'
      : suggestion.research === 'done'
        ? ', vérifiée sur le web'
        : ''
  return (
    <motion.div {...motionProps} className="dive-ghost-wrap group absolute" style={style}>
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
    </motion.div>
  )
}
