/**
 * Place d'un widget posé par Claude à côté du nœud qu'il illustre (spec 026 D11) : à droite du nœud, puis décalé vers le
 * bas ou le haut tant qu'il chevaucherait un autre nœud. Rectangles par leur centre (`nodeOrigin` de la carte). Pure.
 */

export interface CenteredBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Air entre le nœud et le widget, et marge gardée autour des autres nœuds. */
const GAP = 48
const MARGIN = 16
/** Essais de décalage (en alternance bas, haut), d'une demi-hauteur de widget chacun. */
const TRIES = 16

const overlaps = (a: CenteredBox, b: CenteredBox): boolean =>
  Math.abs(a.x - b.x) * 2 < a.width + b.width + MARGIN * 2 && Math.abs(a.y - b.y) * 2 < a.height + b.height + MARGIN * 2

export function besideAnchor(
  anchor: CenteredBox,
  size: { readonly width: number; readonly height: number },
  others: readonly CenteredBox[]
): { readonly x: number; readonly y: number } {
  const x = anchor.x + anchor.width / 2 + GAP + size.width / 2
  const step = size.height / 2
  for (let i = 0; i <= TRIES; i++) {
    const offset = i === 0 ? 0 : Math.ceil(i / 2) * step * (i % 2 === 1 ? 1 : -1)
    const candidate = { x, y: anchor.y + offset, ...size }
    if (!others.some((other) => overlaps(candidate, other))) return { x, y: candidate.y }
  }
  return { x, y: anchor.y }
}
