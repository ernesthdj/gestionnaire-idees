import type { ElementRelation, ElementView, MapLinkView, MeasuredLinkView } from '@shared/ipc/canvas'
import { weakestProvenance, type LinkProvenance } from '@shared/ipc/reprise'

/**
 * Carte de structure d'un projet à l'écran (spec 009, L3 §5) : quels éléments sont visibles (repli), où ils se
 * placent (arbre en colonnes à droite de leur genesis), et quels liens typés tracer — un lien vers un élément replié
 * se rattache à son ancêtre visible, regroupé avec ses semblables ; de même pour les appels mesurés par l'analyse
 * d'un projet repris (spec 017 US7), sommés et ramenés à leur fiabilité la plus faible. Fonction pure.
 */

export const ELEMENT_SIZE = { width: 240, height: 96 } as const
const COLUMN = ELEMENT_SIZE.width + 72
const ROW_GAP = 20
/** Écart entre le genesis et la première colonne de sa carte. */
const FIRST_COLUMN = 220

export interface PlacedElement {
  readonly element: ElementView
  readonly x: number
  readonly y: number
  /** Profondeur dans la carte (1 : enfant du genesis). */
  readonly depth: number
}

export interface StructureEdge {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly kind: 'hierarchy' | 'relation' | 'measured'
  readonly relation: ElementRelation | null
  readonly label: string | null
  /** Nombre de liens regroupés (parties repliées) ; pour un lien mesuré, nombre d'appels. */
  readonly count: number
  /** Fiabilité la plus faible des appels d'un lien mesuré ; `null` sinon. */
  readonly provenance: LinkProvenance | null
}

export interface StructureGraph {
  readonly placed: readonly PlacedElement[]
  readonly edges: readonly StructureEdge[]
}

export function structureGraph(
  elements: readonly ElementView[],
  genesisCenters: ReadonlyMap<string, { readonly x: number; readonly y: number }>,
  links: readonly MapLinkView[],
  measured: readonly MeasuredLinkView[] = []
): StructureGraph {
  const byId = new Map(elements.map((element) => [element.id, element] as const))
  const children = new Map<string, ElementView[]>()
  for (const element of elements) children.set(element.parentId, [...(children.get(element.parentId) ?? []), element])

  // Visible : tous les ancêtres (éléments) sont dépliés ; le genesis est toujours déplié.
  const visible = new Set<string>()
  const walkVisible = (parentId: string): void => {
    for (const child of children.get(parentId) ?? []) {
      visible.add(child.id)
      if (!child.collapsed) walkVisible(child.id)
    }
  }
  const genesisIds = [...new Set(elements.map((element) => element.genesisId))].filter((id) => genesisCenters.has(id))
  for (const genesisId of genesisIds) walkVisible(genesisId)

  // Placement : feuilles empilées, parent centré sur ses enfants visibles ; l'arbre est centré sur le genesis.
  const placed: PlacedElement[] = []
  for (const genesisId of genesisIds) {
    const center = genesisCenters.get(genesisId) as { x: number; y: number }
    const local: { element: ElementView; depth: number; y: number }[] = []
    let cursor = 0
    const place = (element: ElementView, depth: number): { top: number; bottom: number } => {
      const kids = element.collapsed ? [] : (children.get(element.id) ?? []).filter((kid) => visible.has(kid.id))
      if (kids.length === 0) {
        const top = cursor
        cursor += ELEMENT_SIZE.height + ROW_GAP
        local.push({ element, depth, y: top + ELEMENT_SIZE.height / 2 })
        return { top, bottom: top + ELEMENT_SIZE.height }
      }
      const spans = kids.map((kid) => place(kid, depth + 1))
      const top = (spans[0] as { top: number }).top
      const bottom = (spans[spans.length - 1] as { bottom: number }).bottom
      local.push({ element, depth, y: (top + bottom) / 2 })
      return { top, bottom }
    }
    for (const root of (children.get(genesisId) ?? []).filter((kid) => visible.has(kid.id))) place(root, 1)
    const height = Math.max(0, cursor - ROW_GAP)
    for (const entry of local) {
      placed.push({
        element: entry.element,
        depth: entry.depth,
        x: center.x + FIRST_COLUMN + (entry.depth - 1) * COLUMN + ELEMENT_SIZE.width / 2,
        y: center.y - height / 2 + entry.y
      })
    }
  }

  // Liens : hiérarchie (parent visible → enfant visible), puis liens typés rattachés aux ancêtres visibles.
  const edges: StructureEdge[] = placed.map((entry) => ({
    id: `struct-${entry.element.id}`,
    source: entry.element.parentId,
    target: entry.element.id,
    kind: 'hierarchy',
    relation: null,
    label: null,
    count: 1,
    provenance: null
  }))
  const visibleEnd = (id: string): string | null => {
    let current: string | undefined = id
    for (let guard = 0; current !== undefined && guard < 100; guard++) {
      if (visible.has(current)) return current
      const element = byId.get(current)
      if (element === undefined) return genesisCenters.has(current) ? current : null
      current = element.parentId
    }
    return null
  }
  const grouped = new Map<string, StructureEdge>()
  for (const link of links) {
    if (link.relation === null) continue
    const source = visibleEnd(link.from.id)
    const target = visibleEnd(link.to.id)
    if (source === null || target === null || source === target) continue
    const key = `${source}>${target}>${link.relation}`
    const existing = grouped.get(key)
    grouped.set(key, {
      id: `rel-${existing === undefined ? link.id : existing.id.slice(4)}`,
      source,
      target,
      kind: 'relation',
      relation: link.relation,
      label: existing === undefined ? link.label : null,
      count: (existing?.count ?? 0) + 1,
      provenance: null
    })
  }
  const calls = new Map<string, StructureEdge>()
  for (const link of measured) {
    const source = visibleEnd(link.from)
    const target = visibleEnd(link.to)
    if (source === null || target === null || source === target) continue
    const key = `${source}>${target}`
    const existing = calls.get(key)
    const provenance =
      existing === undefined || existing.provenance === null
        ? link.provenance
        : weakestProvenance(existing.provenance, link.provenance)
    calls.set(key, {
      id: `calls-${key}`,
      source,
      target,
      kind: 'measured',
      relation: null,
      label: null,
      count: (existing?.count ?? 0) + link.count,
      provenance
    })
  }
  return { placed, edges: [...edges, ...grouped.values(), ...calls.values()] }
}
