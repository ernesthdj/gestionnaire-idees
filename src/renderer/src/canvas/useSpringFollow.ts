import { useEffect, useRef, useState } from 'react'
import type { Point } from './ideaTreeLayout'

/** Raideur et amortissement du ressort : l'arbre suit son idée avec un léger retard flottant. */
const STIFFNESS = 0.12
const DAMPING = 0.75
const REST = 0.3

/**
 * Suit une cible avec un ressort amorti (une image à la fois). Sans animation (mode réduit), renvoie la cible.
 * Au premier rendu, la position est la cible : rien ne « vole » à l'ouverture.
 */
export function useSpringFollow(target: Point, animate: boolean): Point {
  const [position, setPosition] = useState(target)
  const state = useRef({ position: target, velocity: { x: 0, y: 0 } })
  const { x: targetX, y: targetY } = target

  useEffect(() => {
    if (!animate) {
      state.current = { position: { x: targetX, y: targetY }, velocity: { x: 0, y: 0 } }
      setPosition({ x: targetX, y: targetY })
      return
    }
    let frame = 0
    const step = (): void => {
      const { position: current, velocity } = state.current
      const vx = (velocity.x + (targetX - current.x) * STIFFNESS) * DAMPING
      const vy = (velocity.y + (targetY - current.y) * STIFFNESS) * DAMPING
      const next = { x: current.x + vx, y: current.y + vy }
      const resting = Math.hypot(targetX - next.x, targetY - next.y) < REST && Math.hypot(vx, vy) < REST
      state.current = resting
        ? { position: { x: targetX, y: targetY }, velocity: { x: 0, y: 0 } }
        : { position: next, velocity: { x: vx, y: vy } }
      setPosition(state.current.position)
      if (!resting) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [targetX, targetY, animate])

  return animate ? position : target
}
