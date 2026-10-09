import type { WorkflowFileSummaryView } from '@shared/ipc/workflow'

/** Boîte du petit schéma : l'entrée, un morceau (numéroté comme dans la liste) ou la sortie. */
export interface FlowBox {
  readonly id: string
  readonly kind: 'in' | 'part' | 'out'
  readonly label: string
  /** Numéro du morceau dans « Les morceaux importants » ; `null` pour l'entrée et la sortie. */
  readonly number: number | null
  readonly x: number
  readonly y: number
  readonly width: number
}

export interface FlowArrow {
  readonly from: string
  readonly to: string
  /** Verbe complet (bulle au survol). */
  readonly label: string
  /** Verbe affiché, coupé au-delà de `LABEL_MAX` caractères. */
  readonly text: string
  /** Chemin SVG de la flèche. */
  readonly path: string
  /** Centre de la pastille du verbe, et sa largeur. */
  readonly labelX: number
  readonly labelY: number
  readonly labelWidth: number
}

export const BOX_HEIGHT = 34
export const LABEL_HEIGHT = 18
const LABEL_MAX = 24
const RANK_GAP = 84
const GAP_X = 36
const PAD = 12

/** Largeur d'une boîte selon son texte (police de 12 px environ), bornée. */
const widthOf = (label: string): number => Math.min(220, Math.max(96, label.length * 7.2 + 28))
/** Largeur de la pastille d'un verbe (police de 11 px environ). */
const labelWidthOf = (text: string): number => text.length * 6.2 + 14

interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/** Point d'une courbe de Bézier cubique à l'instant `t`. */
const bezier = (t: number, p0: number, p1: number, p2: number, p3: number): number =>
  (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3

/**
 * Disposition du petit schéma d'un fichier (spec 023 D15, précisé ; D17 : « il doit respirer ») : de haut en bas, la
 * sortie en bas ; l'entrée et les morceaux que rien n'appelle sur la première rangée (une flèche ne traverse pas une
 * rangée de départs) ; chaque autre morceau au rang de son plus long chemin (une flèche qui remonte, rare, contourne
 * par la droite) ; dans un rang, l'ordre des morceaux de la liste. Chaque verbe est posé sur une pastille près du
 * départ de sa flèche, puis décalé s'il touche une boîte ou une autre pastille. Pure : aucune mesure du DOM.
 */
export function flowLayout(summary: Pick<WorkflowFileSummaryView, 'parts' | 'flow'>): {
  readonly boxes: readonly FlowBox[]
  readonly arrows: readonly FlowArrow[]
  readonly width: number
  readonly height: number
} {
  if (summary.flow.length === 0) return { boxes: [], arrows: [], width: 0, height: 0 }
  const order = new Map(summary.parts.map((part, index) => [part.name, index] as const))
  const ids = new Set(summary.flow.flatMap((arrow) => [arrow.from, arrow.to]))
  const out = new Map<string, string[]>()
  for (const arrow of summary.flow) out.set(arrow.from, [...(out.get(arrow.from) ?? []), arrow.to])

  // Rang = plus long chemin depuis un départ ; une flèche vers un nœud en cours de visite (cycle) est ignorée.
  const rank = new Map<string, number>()
  const visiting = new Set<string>()
  const place = (id: string, depth: number): void => {
    if (visiting.has(id) || (rank.get(id) ?? -1) >= depth) return
    rank.set(id, depth)
    visiting.add(id)
    for (const next of out.get(id) ?? []) if (next !== 'out') place(next, depth + 1)
    visiting.delete(id)
  }
  const targets = new Set(summary.flow.map((arrow) => arrow.to))
  const starts = [...ids].filter((id) => id !== 'out' && !targets.has(id))
  for (const id of starts) place(id, 0)
  // Un cycle sans départ : il part de la première rangée.
  for (const id of ids) if (!rank.has(id) && id !== 'out') place(id, 0)
  const bottom = Math.max(0, ...rank.values()) + 1
  if (ids.has('out')) rank.set('out', bottom)

  const label = (id: string): string =>
    id === 'in' ? 'Reçoit' : id === 'out' ? 'Produit' : `${(order.get(id) ?? 0) + 1}. ${id}`
  const rows = new Map<number, string[]>()
  for (const id of ids) rows.set(rank.get(id) ?? 0, [...(rows.get(rank.get(id) ?? 0) ?? []), id])
  const rowWidth = (row: readonly string[]): number =>
    row.reduce((sum, id) => sum + widthOf(label(id)), 0) + (row.length - 1) * GAP_X
  const width = Math.max(...[...rows.values()].map(rowWidth)) + 2 * PAD + 48

  const boxes: FlowBox[] = []
  for (const [row, members] of rows) {
    // L'entrée d'abord, puis l'ordre de la liste des morceaux.
    members.sort((a, b) => (a === 'in' ? -1 : b === 'in' ? 1 : (order.get(a) ?? -1) - (order.get(b) ?? -1)))
    let x = (width - 48 - rowWidth(members)) / 2
    for (const id of members) {
      const boxWidth = widthOf(label(id))
      boxes.push({
        id,
        kind: id === 'in' ? 'in' : id === 'out' ? 'out' : 'part',
        label: label(id),
        number: id === 'in' || id === 'out' ? null : (order.get(id) ?? 0) + 1,
        x,
        y: PAD + row * (BOX_HEIGHT + RANK_GAP),
        width: boxWidth
      })
      x += boxWidth + GAP_X
    }
  }
  const byId = new Map(boxes.map((box) => [box.id, box] as const))
  const taken: Rect[] = boxes.map((box) => ({
    x: box.x - 4,
    y: box.y - 4,
    width: box.width + 8,
    height: BOX_HEIGHT + 8
  }))
  const arrows: FlowArrow[] = summary.flow.flatMap((arrow) => {
    const a = byId.get(arrow.from)
    const b = byId.get(arrow.to)
    if (a === undefined || b === undefined) return []
    const text = arrow.label.length > LABEL_MAX ? `${arrow.label.slice(0, LABEL_MAX - 1)}…` : arrow.label
    const labelWidth = labelWidthOf(text)
    const x1 = a.x + a.width / 2
    const x2 = b.x + b.width / 2
    let path: string
    let labelX: number
    let labelY: number
    let step: number
    if (b.y > a.y) {
      const y1 = a.y + BOX_HEIGHT
      const y2 = b.y - 2
      const middle = (y1 + y2) / 2
      path = `M ${x1} ${y1} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${y2}`
      // Près du départ : deux flèches qui convergent n'ont pas leurs verbes au même endroit.
      labelX = bezier(0.3, x1, x1, x2, x2)
      labelY = bezier(0.3, y1, middle, middle, y2)
      step = LABEL_HEIGHT
    } else {
      // Flèche qui remonte (ou dans le même rang) : contourne par la droite.
      const side = width - 24
      const y1 = a.y + BOX_HEIGHT / 2
      const y2 = b.y + BOX_HEIGHT / 2
      path = `M ${a.x + a.width} ${y1} C ${side} ${y1}, ${side} ${y2}, ${b.x + b.width + 2} ${y2}`
      labelX = side - labelWidth / 2
      labelY = (y1 + y2) / 2
      step = -LABEL_HEIGHT
    }
    labelX = Math.min(width - labelWidth / 2 - 2, Math.max(labelWidth / 2 + 2, labelX))
    const rect = (): Rect => ({
      x: labelX - labelWidth / 2,
      y: labelY - LABEL_HEIGHT / 2,
      width: labelWidth,
      height: LABEL_HEIGHT
    })
    // Décalage le long de la rangée libre jusqu'à ne plus toucher une boîte ni une autre pastille.
    for (let tries = 0; tries < 6 && taken.some((other) => overlaps(rect(), other)); tries++) labelY += step / 2
    taken.push(rect())
    return [{ ...arrow, text, path, labelX, labelY, labelWidth }]
  })
  return { boxes, arrows, width, height: PAD * 2 + bottom * (BOX_HEIGHT + RANK_GAP) + BOX_HEIGHT }
}

/** Texte sûr dans un libellé Mermaid : guillemets et barres échappés, une seule ligne, 80 caractères au plus. */
const mermaidText = (text: string): string =>
  text.replace(/\s+/g, ' ').trim().slice(0, 80).replace(/"/g, '#quot;').replace(/\|/g, '#124;')

/**
 * Le même schéma en Mermaid (`flowchart TD`), à copier dans des notes : identifiants générés (`in`, `p1`…, `out`),
 * libellés échappés — le texte de l'explication ne peut pas casser la syntaxe.
 */
export function flowMermaid(
  summary: Pick<WorkflowFileSummaryView, 'receives' | 'produces' | 'parts' | 'flow'>
): string {
  const index = new Map(summary.parts.map((part, position) => [part.name, position + 1] as const))
  const idOf = (id: string): string => (id === 'in' || id === 'out' ? id : `p${index.get(id) ?? 0}`)
  const ids = new Set(summary.flow.flatMap((arrow) => [arrow.from, arrow.to]))
  const nodes = [...ids].map((id) =>
    id === 'in'
      ? `  in(["Reçoit : ${mermaidText(summary.receives)}"])`
      : id === 'out'
        ? `  out(["Produit : ${mermaidText(summary.produces)}"])`
        : `  ${idOf(id)}["${index.get(id) ?? 0}. ${mermaidText(id)}"]`
  )
  const links = summary.flow.map((arrow) => `  ${idOf(arrow.from)} -->|${mermaidText(arrow.label)}| ${idOf(arrow.to)}`)
  return ['flowchart TD', ...nodes, ...links].join('\n')
}
