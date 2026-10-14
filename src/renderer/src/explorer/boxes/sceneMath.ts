import type { Rect } from './boxLayout'

/**
 * Calculs purs des transitions de l'explorateur (spec 031 D4, D6) : deux scènes (la carte d'ensemble et l'intérieur
 * d'un module) cadrent chacune leur nœud dans le même rectangle à chaque image ; le rectangle va de la boîte de départ
 * au cadre d'arrivée. Les fondus sont calés sur le temps, le mouvement sur une courbe adoucie aux deux bouts.
 */

export interface Viewport {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

/** Durée d'une transition (ms) ; 0 si les animations sont réduites. */
export const MORPH_MS = 700

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  width: lerp(a.width, b.width, t),
  height: lerp(a.height, b.height, t)
})
/** Mouvement : lent au départ et à l'arrivée. */
export const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const smooth = (t: number): number => t * t * (3 - 2 * t)
/** Fondu sur la fenêtre [a, b] du temps, adouci aux deux bouts : 0 avant, 1 après. */
export const fadeIn = (t: number, a: number, b: number): number => smooth(Math.max(0, Math.min(1, (t - a) / (b - a))))

/**
 * Vue (déplacement et zoom) qui pose le rectangle `node` (coordonnées de la carte) au centre du rectangle `to` (pixels
 * de l'écran), à la plus grande échelle où il y tient : la même règle pour les deux scènes donne une échelle commune.
 */
export function viewportOnto(node: Rect, to: Rect): Viewport {
  const zoom = Math.min(to.width / node.width, to.height / node.height)
  return {
    zoom,
    x: to.x + to.width / 2 - (node.x + node.width / 2) * zoom,
    y: to.y + to.height / 2 - (node.y + node.height / 2) * zoom
  }
}

/** Rectangle de la carte (coordonnées) vu à l'écran par une vue. */
export const onScreen = (rect: Rect, view: Viewport): Rect => ({
  x: view.x + rect.x * view.zoom,
  y: view.y + rect.y * view.zoom,
  width: rect.width * view.zoom,
  height: rect.height * view.zoom
})

/**
 * Cadrage d'un intérieur (spec 031 D5) : tout voir sans descendre sous 80 % (sinon les noms deviennent illisibles),
 * centré quand il tient, calé en haut à gauche sinon (le reste se rejoint en glissant).
 */
export function fitFrame(
  frame: { readonly width: number; readonly height: number },
  box: { readonly width: number; readonly height: number },
  margin = 16
): Viewport {
  const zoom = Math.max(
    0.8,
    Math.min(1, (box.width - 2 * margin) / frame.width, (box.height - 2 * margin) / frame.height)
  )
  return {
    zoom,
    x: Math.max(margin, (box.width - frame.width * zoom) / 2),
    y: Math.max(margin, (box.height - frame.height * zoom) / 2)
  }
}
