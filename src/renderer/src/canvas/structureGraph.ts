import type { ElementRelation, ElementView, MapLinkView, MeasuredLinkView } from '@shared/ipc/canvas'
import { weakestProvenance, type LinkProvenance } from '@shared/ipc/reprise'

/**
 * Carte de structure d'un projet à l'écran (spec 009, L3 §5 ; spec 017 D14–D15) : quels éléments sont visibles (repli),
 * où ils se placent (arbre en colonnes à droite de leur genesis, aéré : écart entre nœuds, et plus encore entre
 * modules de niveau 1), et quels liens tracer selon le focus — au repos, ceux entre éléments de niveau 1, agrégés ;
 * pour l'élément en focus, ses propres liens, rattachés à l'élément visible de l'autre bout. Fonctions pures.
 */

export const ELEMENT_SIZE = { width: 240, height: 96 } as const
/** Espacement de l'arbre (D14) : colonnes, nœuds d'une même colonne, et sous-arbres de deux modules de niveau 1. */
export const SPACING = { column: ELEMENT_SIZE.width + 140, row: 40, module: 120 } as const
/** Écart entre le genesis et la première colonne de sa carte. */
const FIRST_COLUMN = 240

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
  /** Nombre de liens regroupés ; pour un lien mesuré, nombre d'appels. */
  readonly count: number
  /** Fiabilité la plus faible des appels d'un lien mesuré ; `null` sinon. */
  readonly provenance: LinkProvenance | null
  /** Lien de l'élément en focus (détail) plutôt qu'agrégé au niveau 1. */
  readonly focused: boolean
}

export interface StructureGraph {
  readonly placed: readonly PlacedElement[]
  readonly edges: readonly StructureEdge[]
}

interface Tree {
  readonly byId: ReadonlyMap<string, ElementView>
  readonly children: ReadonlyMap<string, readonly ElementView[]>
  readonly visible: ReadonlySet<string>
}

function treeOf(elements: readonly ElementView[], genesisIds: readonly string[]): Tree {
  const byId = new Map(elements.map((element) => [element.id, element] as const))
  const children = new Map<string, ElementView[]>()
  for (const element of elements) children.set(element.parentId, [...(children.get(element.parentId) ?? []), element])
  // Visible : tous les ancêtres (éléments) sont dépliés ; le genesis est toujours déplié.
  const visible = new Set<string>()
  const walk = (parentId: string): void => {
    for (const child of children.get(parentId) ?? []) {
      visible.add(child.id)
      if (!child.collapsed) walk(child.id)
    }
  }
  for (const genesisId of genesisIds) walk(genesisId)
  return { byId, children, visible }
}

export function structureGraph(
  elements: readonly ElementView[],
  genesisCenters: ReadonlyMap<string, { readonly x: number; readonly y: number }>,
  links: readonly MapLinkView[],
  measured: readonly MeasuredLinkView[] = []
): StructureGraph {
  const genesisIds = [...new Set(elements.map((element) => element.genesisId))].filter((id) => genesisCenters.has(id))
  const tree = treeOf(elements, genesisIds)

  // Placement : feuilles empilées, parent centré sur ses enfants visibles ; un écart de plus entre deux modules de
  // niveau 1 sépare leurs sous-arbres ; l'arbre est centré sur le genesis.
  const placed: PlacedElement[] = []
  for (const genesisId of genesisIds) {
    const center = genesisCenters.get(genesisId) as { x: number; y: number }
    const local: { element: ElementView; depth: number; y: number }[] = []
    let cursor = 0
    const place = (element: ElementView, depth: number): { top: number; bottom: number } => {
      const kids = element.collapsed
        ? []
        : (tree.children.get(element.id) ?? []).filter((kid) => tree.visible.has(kid.id))
      if (kids.length === 0) {
        const top = cursor
        cursor += ELEMENT_SIZE.height + SPACING.row
        local.push({ element, depth, y: top + ELEMENT_SIZE.height / 2 })
        return { top, bottom: top + ELEMENT_SIZE.height }
      }
      const spans = kids.map((kid) => place(kid, depth + 1))
      const top = (spans[0] as { top: number }).top
      const bottom = (spans[spans.length - 1] as { bottom: number }).bottom
      local.push({ element, depth, y: (top + bottom) / 2 })
      return { top, bottom }
    }
    const roots = (tree.children.get(genesisId) ?? []).filter((kid) => tree.visible.has(kid.id))
    roots.forEach((root, index) => {
      if (index > 0) cursor += SPACING.module
      place(root, 1)
    })
    const height = Math.max(0, cursor - SPACING.row)
    for (const entry of local) {
      placed.push({
        element: entry.element,
        depth: entry.depth,
        x: center.x + FIRST_COLUMN + (entry.depth - 1) * SPACING.column + ELEMENT_SIZE.width / 2,
        y: center.y - height / 2 + entry.y
      })
    }
  }

  // Hiérarchie (parent visible → enfant visible), puis, au repos, les liens agrégés entre éléments de niveau 1.
  const hierarchy: StructureEdge[] = placed.map((entry) => ({
    id: `struct-${entry.element.id}`,
    source: entry.element.parentId,
    target: entry.element.id,
    kind: 'hierarchy',
    relation: null,
    label: null,
    count: 1,
    provenance: null,
    focused: false
  }))
  const topOf = (id: string): string | null => {
    let current = tree.byId.get(id)
    for (let guard = 0; current !== undefined && guard < 100; guard++) {
      if (!tree.byId.has(current.parentId)) return genesisCenters.has(current.parentId) ? current.id : null
      current = tree.byId.get(current.parentId)
    }
    return null
  }
  return { placed, edges: [...hierarchy, ...linkEdges(links, measured, topOf, () => true, false)] }
}

/**
 * Liens détaillés de l'élément en focus (D15) : ceux dont un bout est cet élément ou l'un de ses descendants,
 * rattachés à l'élément visible le plus proche de chaque bout. Vide sans focus ou pour un élément hors carte.
 */
export function focusEdges(
  elements: readonly ElementView[],
  links: readonly MapLinkView[],
  measured: readonly MeasuredLinkView[],
  focusId: string | null
): StructureEdge[] {
  if (focusId === null) return []
  const focus = elements.find((element) => element.id === focusId)
  if (focus === undefined) return []
  const tree = treeOf(elements, [focus.genesisId])
  const inFocus = (id: string): boolean => {
    let current = tree.byId.get(id)
    for (let guard = 0; current !== undefined && guard < 100; guard++) {
      if (current.id === focusId) return true
      current = tree.byId.get(current.parentId)
    }
    return false
  }
  const visibleEnd = (id: string): string | null => {
    let current = tree.byId.get(id)
    for (let guard = 0; current !== undefined && guard < 100; guard++) {
      if (tree.visible.has(current.id)) return current.id
      current = tree.byId.get(current.parentId)
    }
    return null
  }
  return linkEdges(links, measured, visibleEnd, (from, to) => inFocus(from) || inFocus(to), true)
}

/** Liens de Claude regroupés par relation, appels mesurés sommés, chaque bout ramené par `endOf`. */
function linkEdges(
  links: readonly MapLinkView[],
  measured: readonly MeasuredLinkView[],
  endOf: (id: string) => string | null,
  keep: (from: string, to: string) => boolean,
  focused: boolean
): StructureEdge[] {
  const prefix = focused ? 'focus-' : ''
  const grouped = new Map<string, StructureEdge>()
  for (const link of links) {
    if (link.relation === null || !keep(link.from.id, link.to.id)) continue
    const source = endOf(link.from.id)
    const target = endOf(link.to.id)
    if (source === null || target === null || source === target) continue
    const key = `${source}>${target}>${link.relation}`
    const existing = grouped.get(key)
    grouped.set(key, {
      id: existing?.id ?? `${prefix}rel-${link.id}`,
      source,
      target,
      kind: 'relation',
      relation: link.relation,
      label: existing === undefined ? link.label : null,
      count: (existing?.count ?? 0) + 1,
      provenance: null,
      focused
    })
  }
  const calls = new Map<string, StructureEdge>()
  for (const link of measured) {
    if (!keep(link.from, link.to)) continue
    const source = endOf(link.from)
    const target = endOf(link.to)
    if (source === null || target === null || source === target) continue
    const key = `${source}>${target}`
    const existing = calls.get(key)
    calls.set(key, {
      id: `${prefix}calls-${key}`,
      source,
      target,
      kind: 'measured',
      relation: null,
      label: null,
      count: (existing?.count ?? 0) + link.count,
      provenance:
        existing === undefined || existing.provenance === null
          ? link.provenance
          : weakestProvenance(existing.provenance, link.provenance),
      focused
    })
  }
  return [...grouped.values(), ...calls.values()]
}
