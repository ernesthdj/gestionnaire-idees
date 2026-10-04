/**
 * Placement d'un lot dessiné par Claude (spec 007 FR-010, research R7) : arbre en colonnes (profondeur → colonne,
 * frères empilés, parent centré sur ses enfants), cadre englobant, zone libre sans recouvrement. Fonction pure et
 * déterministe. Coordonnées = centres (comme la carte : nodeOrigin 0.5).
 */

export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface LayoutItem {
  readonly key: string
  /** Clé du parent dans le lot ; `null` : racine du lot. */
  readonly parent: string | null
  readonly width: number
  readonly height: number
}

export interface LayoutInput {
  readonly items: readonly LayoutItem[]
  /** Rectangles (centre + taille) déjà occupés sur la carte. */
  readonly occupied: readonly Rect[]
  /** Élément existant près duquel poser le lot (dessous). */
  readonly anchor?: Rect
  /** Le lot est regroupé dans un cadre titré. */
  readonly framed: boolean
}

export interface LayoutOutput {
  readonly centers: ReadonlyMap<string, { readonly x: number; readonly y: number }>
  /** Cadre englobant (centre + taille) ; `null` sans cadre. */
  readonly frame: Rect | null
}

export const LAYOUT = {
  columnGap: 56,
  rowGap: 24,
  framePadding: 32,
  frameHeader: 56,
  /** Marge entre le lot et ce qui existe déjà. */
  clearance: 80
} as const

/** Rectangle occupé (bord gauche, haut, droit, bas). */
interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

const boxOf = (rect: Rect): Box => ({
  left: rect.x - rect.width / 2,
  top: rect.y - rect.height / 2,
  right: rect.x + rect.width / 2,
  bottom: rect.y + rect.height / 2
})

const intersects = (a: Box, b: Box, margin: number): boolean =>
  a.left < b.right + margin && b.left < a.right + margin && a.top < b.bottom + margin && b.top < a.bottom + margin

/** Hauteur d'une note selon son titre et son texte (largeur fixe), bornée. */
export function noteHeight(title: string, text: string | null): number {
  const titleLines = Math.max(1, Math.ceil(title.length / 28))
  const textLines = text === null ? 0 : Math.min(14, Math.ceil(Math.min(text.length, 700) / 36))
  return Math.min(360, Math.max(56, 24 + titleLines * 20 + (textLines === 0 ? 0 : 8 + textLines * 16)))
}

export const NOTE_WIDTH = 240

export function layoutBatch(input: LayoutInput): LayoutOutput {
  const { items } = input
  const children = new Map<string | null, LayoutItem[]>()
  for (const item of items) children.set(item.parent, [...(children.get(item.parent) ?? []), item])
  const depthOf = new Map<string, number>()
  const columnWidth = new Map<number, number>()

  // 1. Profondeurs et largeur de chaque colonne.
  const visitDepth = (item: LayoutItem, depth: number): void => {
    depthOf.set(item.key, depth)
    columnWidth.set(depth, Math.max(columnWidth.get(depth) ?? 0, item.width))
    for (const child of children.get(item.key) ?? []) visitDepth(child, depth + 1)
  }
  for (const root of children.get(null) ?? []) visitDepth(root, 0)
  const columnLeft = new Map<number, number>()
  let left = 0
  for (let depth = 0; columnWidth.has(depth); depth++) {
    columnLeft.set(depth, left)
    left += (columnWidth.get(depth) ?? 0) + LAYOUT.columnGap
  }

  // 2. Empilement : chaque feuille prend la place suivante ; un parent se centre sur ses enfants.
  const local = new Map<string, { x: number; y: number }>()
  let cursor = 0
  const place = (item: LayoutItem): { top: number; bottom: number } => {
    const depth = depthOf.get(item.key) ?? 0
    const x = (columnLeft.get(depth) ?? 0) + item.width / 2
    const kids = children.get(item.key) ?? []
    if (kids.length === 0) {
      const top = cursor
      cursor += item.height + LAYOUT.rowGap
      local.set(item.key, { x, y: top + item.height / 2 })
      return { top, bottom: top + item.height }
    }
    const spans = kids.map(place)
    const first = spans[0] as { top: number }
    const last = spans[spans.length - 1] as { bottom: number }
    const center = (first.top + last.bottom) / 2
    // Un parent plus haut que ses enfants repousse la suite.
    const top = Math.min(first.top, center - item.height / 2)
    const bottom = Math.max(last.bottom, center + item.height / 2)
    cursor = Math.max(cursor, bottom + LAYOUT.rowGap)
    local.set(item.key, { x, y: center })
    return { top, bottom }
  }
  for (const root of children.get(null) ?? []) place(root)

  // 3. Enveloppe locale (avec cadre éventuel).
  const sizes = new Map(items.map((item) => [item.key, item] as const))
  let content: Box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
  for (const [key, center] of local) {
    const size = sizes.get(key) as LayoutItem
    const box = boxOf({ ...center, width: size.width, height: size.height })
    content = {
      left: Math.min(content.left, box.left),
      top: Math.min(content.top, box.top),
      right: Math.max(content.right, box.right),
      bottom: Math.max(content.bottom, box.bottom)
    }
  }
  const outer: Box = input.framed
    ? {
        left: content.left - LAYOUT.framePadding,
        top: content.top - LAYOUT.framePadding - LAYOUT.frameHeader,
        right: content.right + LAYOUT.framePadding,
        bottom: content.bottom + LAYOUT.framePadding
      }
    : content
  const width = outer.right - outer.left
  const height = outer.bottom - outer.top

  // 4. Point de départ : sous l'ancre, sinon à droite de tout ce qui existe ; puis on descend jusqu'à la place libre.
  const occupied = input.occupied.map(boxOf)
  let originLeft: number
  let originTop: number
  if (input.anchor !== undefined) {
    const anchor = boxOf(input.anchor)
    originLeft = anchor.left
    originTop = anchor.bottom + LAYOUT.clearance
  } else if (occupied.length === 0) {
    originLeft = 0
    originTop = 0
  } else {
    originLeft = Math.max(...occupied.map((box) => box.right)) + LAYOUT.clearance
    originTop = Math.min(...occupied.map((box) => box.top))
  }
  const at = (top: number): Box => ({ left: originLeft, top, right: originLeft + width, bottom: top + height })
  for (let guard = 0; guard < 1000; guard++) {
    const blocking = occupied.filter((box) => intersects(at(originTop), box, LAYOUT.clearance / 2))
    if (blocking.length === 0) break
    originTop = Math.max(...blocking.map((box) => box.bottom)) + LAYOUT.clearance
  }

  const dx = originLeft - outer.left
  const dy = originTop - outer.top
  const centers = new Map<string, { x: number; y: number }>()
  for (const [key, center] of local) centers.set(key, { x: center.x + dx, y: center.y + dy })
  return {
    centers,
    frame: input.framed ? { x: originLeft + width / 2, y: originTop + height / 2, width, height } : null
  }
}
