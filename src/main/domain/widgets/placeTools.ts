/** Place des outils créés à l'éclosion (spec 006 FR-014) : autour de l'idée, sans recouvrir d'objet de la carte. */

export interface Point {
  readonly x: number
  readonly y: number
}

/** Rectangle par son centre (convention des blocs de la carte). */
export interface Box extends Point {
  readonly width: number
  readonly height: number
}

/** Espace laissé libre entre un outil et ce qui l'entoure. */
const GAP = 32
/** Directions essayées, dans l'ordre : à gauche d'abord (la prochaine étape part en bas à droite), puis autour. */
const DIRECTIONS: readonly Point[] = [
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: -1, y: 1 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 }
]
const RINGS = 12

const overlaps = (a: Box, b: Box): boolean =>
  Math.abs(a.x - b.x) * 2 < a.width + b.width + GAP * 2 && Math.abs(a.y - b.y) * 2 < a.height + b.height + GAP * 2

/**
 * Centres des `count` outils : premier emplacement libre, anneau après anneau autour de l'idée, en évitant l'idée
 * elle-même, les obstacles et les outils déjà placés. Déterministe. Si tout est occupé, empile en dessous.
 */
export function placeTools(
  idea: Box,
  count: number,
  size: { readonly width: number; readonly height: number },
  obstacles: readonly Box[]
): Point[] {
  const taken: Box[] = [idea, ...obstacles]
  const placed: Point[] = []
  const step = Math.max(size.width, size.height) / 2
  for (let index = 0; index < count; index++) {
    let spot: Box | undefined
    for (let ring = 0; ring < RINGS && spot === undefined; ring++) {
      for (const direction of DIRECTIONS) {
        const reachX = idea.width / 2 + GAP + size.width / 2 + ring * step
        const reachY = idea.height / 2 + GAP + size.height / 2 + ring * step
        const candidate: Box = { x: idea.x + direction.x * reachX, y: idea.y + direction.y * reachY, ...size }
        if (!taken.some((box) => overlaps(candidate, box))) {
          spot = candidate
          break
        }
      }
    }
    spot ??= {
      x: idea.x,
      y: idea.y + idea.height / 2 + GAP + size.height / 2 + (RINGS + index) * (size.height + GAP),
      ...size
    }
    taken.push(spot)
    placed.push({ x: Math.round(spot.x), y: Math.round(spot.y) })
  }
  return placed
}
