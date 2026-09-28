/**
 * Disposition radiale de la plongée (research R2) : neurone ciblé au centre, éléments autour sur un arc qui laisse
 * libre la gauche, où se place le parent estompé. Quelques lignes de géométrie, aucune bibliothèque.
 */

export interface Point {
  readonly x: number
  readonly y: number
}

/** Distance minimale entre les centres de deux éléments (cercle de 72 px + titre + marge). */
export const ITEM_SPACING = 112
/** Rayon minimal : l'arc garde de la place autour du neurone ciblé et à côté du parent. */
export const MIN_RADIUS = 216
/** Arc utilisé : 300°, centré à droite ; les 60° restants (à gauche) sont réservés au parent. */
const ARC = (300 * Math.PI) / 180

export interface RadialLayout {
  readonly radius: number
  /** Positions des éléments autour du centre (0, 0), dans l'ordre reçu. */
  readonly items: readonly Point[]
  readonly parent: Point | null
}

export function radialLayout(count: number, hasParent: boolean): RadialLayout {
  // Rayon tel que deux éléments voisins sur l'arc restent à `ITEM_SPACING` l'un de l'autre.
  const step = count === 0 ? ARC : ARC / count
  const radius = Math.max(MIN_RADIUS, count <= 1 ? 0 : ITEM_SPACING / (2 * Math.sin(step / 2)))
  const items = Array.from({ length: count }, (_, index) => {
    const angle = count === 1 ? 0 : -ARC / 2 + step * (index + 0.5)
    return { x: round(radius * Math.cos(angle)), y: round(radius * Math.sin(angle)) }
  })
  return { radius, items, parent: hasParent ? { x: -round(radius), y: 0 } : null }
}

const round = (value: number): number => Math.round(value * 10) / 10
