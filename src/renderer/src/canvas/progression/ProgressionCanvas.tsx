import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Viewport } from '@xyflow/react'
import { wheelFactor, zoomAround, ZOOM_BOUNDS } from '../useSmoothZoom'

/** Marge autour du contenu cadré par « Tout afficher » (px d'écran). */
const FIT_MARGIN = 32
/** Un glisser de moins de ce nombre de pixels reste un clic. */
const DRAG_THRESHOLD = 4
const DOT = 22
/** Ce qui se clique dans le canevas : un appui dessus ne lance pas de déplacement. */
const INTERACTIVE = 'button, a, summary, input, select, textarea, [role="button"]'

export interface Size {
  readonly width: number
  readonly height: number
}

/**
 * Cadre un contenu dans la vue (spec 032 Q8), centré en largeur, collé en haut, jamais agrandi au-delà de 100 % ni
 * réduit sous le zoom minimal. `width` (à l'ouverture d'une lecture) : la largeur tient, on descend en glissant ; `all`
 * (« Tout afficher ») : tout tient. Sans taille connue (pas encore mesuré), la vue reste à 100 %.
 */
export function fitViewport(content: Size, view: Size, margin = FIT_MARGIN, mode: 'width' | 'all' = 'all'): Viewport {
  if (content.width === 0 || content.height === 0 || view.width === 0 || view.height === 0) {
    return { x: margin, y: margin, zoom: 1 }
  }
  const byWidth = (view.width - 2 * margin) / content.width
  const byHeight = mode === 'all' ? (view.height - 2 * margin) / content.height : Infinity
  const zoom = Math.max(ZOOM_BOUNDS.min, Math.min(1, byWidth, byHeight))
  return { x: (view.width - content.width * zoom) / 2, y: margin, zoom }
}

/**
 * Canevas de la Progression (spec 032 Q8) : la molette zoome autour du pointeur, glisser le fond déplace la vue, les
 * boutons zooment et cadrent tout. Le contenu garde sa mise en page (lectures A, B, C) ; il est recadré en entier quand
 * `fitKey` change (autre lecture, autre bascule).
 */
export function ProgressionCanvas({
  fitKey,
  children
}: {
  readonly fitKey: string
  readonly children: ReactNode
}): React.JSX.Element {
  const viewRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: FIT_MARGIN, y: FIT_MARGIN, zoom: 1 })
  const drag = useRef<{ x: number; y: number; from: Viewport; moved: boolean } | null>(null)
  const swallowClick = useRef(false)
  const [grabbing, setGrabbing] = useState(false)

  const fit = useCallback((mode: 'width' | 'all') => {
    const view = viewRef.current
    const content = contentRef.current
    if (view === null || content === null) return
    setViewport(
      fitViewport(
        { width: content.offsetWidth, height: content.offsetHeight },
        { width: view.clientWidth, height: view.clientHeight },
        FIT_MARGIN,
        mode
      )
    )
  }, [])
  useLayoutEffect(() => fit('width'), [fit, fitKey])

  const zoomBy = (factor: number): void => {
    const view = viewRef.current
    const width = view?.clientWidth ?? 0
    const height = view?.clientHeight ?? 0
    setViewport((current) => zoomAround(current, factor, width / 2, height / 2))
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        ref={viewRef}
        data-testid="progression-canvas"
        className={`progress-canvas absolute inset-0 overflow-hidden ${grabbing ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          backgroundSize: `${DOT * viewport.zoom}px ${DOT * viewport.zoom}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`
        }}
        onWheel={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          const factor = wheelFactor(event.deltaY)
          setViewport((current) => zoomAround(current, factor, event.clientX - box.left, event.clientY - box.top))
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as Element).closest(INTERACTIVE) !== null) return
          drag.current = { x: event.clientX, y: event.clientY, from: viewport, moved: false }
          event.currentTarget.setPointerCapture(event.pointerId)
          setGrabbing(true)
        }}
        onPointerMove={(event) => {
          const current = drag.current
          if (current === null) return
          const dx = event.clientX - current.x
          const dy = event.clientY - current.y
          if (!current.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
          current.moved = true
          setViewport({ ...current.from, x: current.from.x + dx, y: current.from.y + dy })
        }}
        onPointerUp={() => {
          swallowClick.current = drag.current?.moved === true
          drag.current = null
          setGrabbing(false)
        }}
        onClickCapture={(event) => {
          // Un glisser qui finit sur une brique ne l'ouvre pas.
          if (!swallowClick.current) return
          swallowClick.current = false
          event.stopPropagation()
        }}
      >
        <div
          ref={contentRef}
          className="absolute left-0 top-0 w-max origin-top-left"
          style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}
        >
          {children}
        </div>
      </div>
      <div
        role="group"
        aria-label="Zoom"
        className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-xl bg-surface shadow-lg"
      >
        <button type="button" aria-label="Zoomer" onClick={() => zoomBy(1.25)} className="progress-zoom">
          +
        </button>
        <span aria-live="polite" className="border-b border-content-muted/20 py-1 text-center text-[11px]">
          {Math.round(viewport.zoom * 100)} %
        </span>
        <button type="button" aria-label="Dézoomer" onClick={() => zoomBy(0.8)} className="progress-zoom">
          −
        </button>
        <button type="button" aria-label="Tout afficher" onClick={() => fit('all')} className="progress-zoom">
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
