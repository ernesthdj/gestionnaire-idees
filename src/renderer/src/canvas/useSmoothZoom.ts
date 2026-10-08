import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { ReactFlowInstance, Viewport } from '@xyflow/react'

/**
 * Zoom fluide (spec 022 D20) : la molette et les boutons font évoluer une cible ; à chaque image, la vue s'en rapproche
 * d'une fraction (amorti), puis s'arrête. Le point sous la souris reste sous la souris. Instantané en animations
 * réduites. Le glisser du fond reste celui de React Flow : s'il bouge la vue pendant l'amorti, celui-ci s'efface.
 */

export const ZOOM_BOUNDS = { min: 0.2, max: 2 } as const
/** Fraction de l'écart parcourue à chaque image. */
export const DAMPING = 0.2
/** Sensibilité de la molette : facteur `exp(-deltaY × WHEEL_RATE)`. */
export const WHEEL_RATE = 0.0012

const clampZoom = (zoom: number): number => Math.min(ZOOM_BOUNDS.max, Math.max(ZOOM_BOUNDS.min, zoom))

/** Nouvelle cible : zoom multiplié par `factor`, borné, autour du point (px, py) de la surface. */
export function zoomAround(target: Viewport, factor: number, px: number, py: number): Viewport {
  const zoom = clampZoom(target.zoom * factor)
  return {
    zoom,
    x: px - ((px - target.x) * zoom) / target.zoom,
    y: py - ((py - target.y) * zoom) / target.zoom
  }
}

/** Facteur d'un cran de molette. */
export const wheelFactor = (deltaY: number): number => Math.exp(-deltaY * WHEEL_RATE)

/** Un pas d'amorti vers la cible ; `null` quand elle est atteinte (à un souffle près). */
export function dampStep(current: Viewport, target: Viewport, damping: number = DAMPING): Viewport | null {
  const dx = target.x - current.x
  const dy = target.y - current.y
  const dz = target.zoom - current.zoom
  if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1 && Math.abs(dz) < 0.0005) return null
  return { x: current.x + dx * damping, y: current.y + dy * damping, zoom: current.zoom + dz * damping }
}

const same = (a: Viewport, b: Viewport): boolean =>
  Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.zoom - b.zoom) < 0.001

/**
 * Branche la molette (écouteur natif non passif) sur la surface de la carte ; renvoie `zoomBy` pour les boutons.
 * Les éléments marqués `nowheel` (cartes de détails, listes) gardent leur défilement.
 */
export function useSmoothZoom(
  flow: Pick<ReactFlowInstance, 'getViewport' | 'setViewport'>,
  surface: RefObject<HTMLElement | null>,
  reduced: boolean
): { readonly zoomBy: (factor: number) => void } {
  const target = useRef<Viewport | null>(null)
  const lastSet = useRef<Viewport | null>(null)
  const frame = useRef(0)

  const run = useCallback((): void => {
    cancelAnimationFrame(frame.current)
    const step = (): void => {
      const goal = target.current
      if (goal === null) return
      const current = flow.getViewport()
      // La vue a bougé sans nous (glisser du fond) : on abandonne l'amorti.
      if (lastSet.current !== null && !same(current, lastSet.current)) {
        target.current = null
        lastSet.current = null
        return
      }
      const next = reduced ? null : dampStep(current, goal)
      const applied = next ?? goal
      void flow.setViewport(applied)
      lastSet.current = applied
      if (next === null) {
        target.current = null
        lastSet.current = null
      } else frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }, [flow, reduced])

  const zoomAt = useCallback(
    (factor: number, px: number, py: number): void => {
      if (target.current === null) lastSet.current = null
      target.current = zoomAround(target.current ?? flow.getViewport(), factor, px, py)
      run()
    },
    [flow, run]
  )

  useEffect(() => {
    const element = surface.current
    if (element === null) return
    const onWheel = (event: WheelEvent): void => {
      if (event.target instanceof Element && event.target.closest('.nowheel') !== null) return
      event.preventDefault()
      const box = element.getBoundingClientRect()
      zoomAt(wheelFactor(event.deltaY), event.clientX - box.left, event.clientY - box.top)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(frame.current)
    }
  }, [surface, zoomAt])

  const zoomBy = useCallback(
    (factor: number): void => {
      const box = surface.current?.getBoundingClientRect()
      if (box === undefined) return
      zoomAt(factor, box.width / 2, box.height / 2)
    },
    [surface, zoomAt]
  )

  return { zoomBy }
}
