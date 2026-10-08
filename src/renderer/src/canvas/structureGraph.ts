import type { ElementRelation, ElementView, MapLinkView, MeasuredLinkView } from '@shared/ipc/canvas'
import { weakestProvenance, type LinkProvenance } from '@shared/ipc/reprise'
import { ARCHITECTURES, DEPENDENCY_RELATIONS, isViolation, type ArchitectureKind } from '@shared/structure/architecture'
import { layoutUnder, type AlternateOptions } from './layout/alternateLayout'
import { progression } from './structureOrder'

/**
 * Carte de structure d'un projet à l'écran (spec 009, L3 §5 ; spec 017 D15, D17) : quels éléments sont visibles
 * (repli), où ils se placent (disposition alternée : modules en colonne sous le genesis, enfants d'un niveau impair en
 * ligne à droite, d'un niveau pair en colonne dessous, dans l'ordre de progression), et quels liens tracer selon le
 * focus — au repos, ceux entre éléments de niveau 1, agrégés ; pour l'élément en focus, ses propres liens, rattachés à
 * l'élément visible de l'autre bout. Fonctions pures.
 */

/** Case d'un élément (spec 022 US3) : un petit cercle vivant et son titre dessous, avec de l'air. */
export const ELEMENT_SIZE = { width: 176, height: 148 } as const
/**
 * Espacement (D17) : entre deux frères d'une ligne (`across`) ou d'une colonne (`down`), en plus entre deux modules de
 * niveau 1 (`module`), et du centre du genesis au premier module (`genesis`).
 */
export const SPACING = { across: 24, down: 8, module: 16, genesis: 120 } as const

export interface PlacedElement {
  readonly element: ElementView
  readonly x: number
  readonly y: number
  /** Profondeur dans la carte (1 : enfant du genesis). */
  readonly depth: number
  /** Numéro de progression (1, 1.2, 1.2.1…). */
  readonly number: string
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
  /** Vue Architecture (D20) : dépendance d'une couche plus profonde vers une moins profonde. */
  readonly violation?: boolean
}

/** Bande d'une couche dans la vue Architecture (D20) ; `layer` null : « Non classés ». Centre, taille. */
export interface LayerBand {
  readonly id: string
  readonly genesisId: string
  readonly layer: string | null
  readonly label: string
  readonly count: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface ArchitectureGraph extends StructureGraph {
  readonly bands: readonly LayerBand[]
}

/** Vue Architecture (D20) : colonnes par rangée de bande, marge intérieure, colonne du nom de couche. */
export const BAND = { columns: 4, gap: 48, padding: 24, label: 176, empty: 72 } as const

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
  measured: readonly MeasuredLinkView[] = [],
  /** « Réorganiser » (spec 022 D22) : les modules partent en ligne à droite du genesis, le sens alterne ensuite. */
  transposed = false
): StructureGraph {
  const genesisIds = [...new Set(elements.map((element) => element.genesisId))].filter((id) => genesisCenters.has(id))
  const tree = treeOf(elements, genesisIds)

  const order = progression(elements, links, measured)
  const visibleKids = (element: { readonly id: string; readonly collapsed?: boolean }): ElementView[] =>
    element.collapsed === true ? [] : (order.children.get(element.id) ?? []).filter((kid) => tree.visible.has(kid.id))
  const placed: PlacedElement[] = []
  // Hiérarchie en chemin (D17) : du parent vers son premier enfant, puis de chaque frère au suivant.
  const hierarchy: StructureEdge[] = []
  const chain = (parentId: string, kids: readonly ElementView[]): void =>
    kids.forEach((kid, index) =>
      hierarchy.push({
        id: `struct-${kid.id}`,
        source: index === 0 ? parentId : (kids[index - 1] as ElementView).id,
        target: kid.id,
        kind: 'hierarchy',
        relation: null,
        label: null,
        count: 1,
        provenance: null,
        focused: false
      })
    )
  // Disposition alternée partagée (spec 022) : boîtes par sous-arbre, rien ne se chevauche ; la hiérarchie se trace en
  // chemin au fil du placement.
  const options: AlternateOptions = {
    childrenOf: (id) => visibleKids({ id, collapsed: tree.byId.get(id)?.collapsed ?? false }).map((kid) => kid.id),
    sizeOf: () => ELEMENT_SIZE,
    across: SPACING.across,
    down: SPACING.down,
    transposed,
    visit: (id, depth, center, kids) => {
      const element = tree.byId.get(id) as ElementView
      placed.push({ element, depth, number: order.numbers.get(id) ?? '', x: center.x, y: center.y })
      chain(
        id,
        kids.map((kid) => tree.byId.get(kid) as ElementView)
      )
    }
  }
  // Les modules (niveau 1) descendent sous le genesis, alignés sur lui, avec de l'air en plus entre deux modules.
  for (const genesisId of genesisIds) {
    const center = genesisCenters.get(genesisId) as { x: number; y: number }
    // Le genesis n'est pas un élément : jamais replié.
    const modules = layoutUnder(genesisId, center, SPACING.genesis, SPACING.module, options)
    chain(
      genesisId,
      modules.map((id) => tree.byId.get(id) as ElementView)
    )
  }
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

/** Compare deux numéros de progression (« 1.10 » après « 1.9 ») ; sans numéro : à la fin. */
function byNumber(a: string, b: string): number {
  if (a === '' || b === '') return a === b ? 0 : a === '' ? 1 : -1
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? -1) - (pb[i] ?? -1)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Vue Architecture d'une carte (spec 017 D20) : les éléments visibles (mêmes règles de repli que la progression)
 * rangés en bandes, une par couche, de l'extérieur (haut) vers le cœur (bas), puis « Non classés » s'il en reste ;
 * dans une bande, dans l'ordre de progression, par rangées de `BAND.columns`. Pas de traits de hiérarchie : les
 * liens de Claude et les appels mesurés, une dépendance qui sort du cœur marquée en violation. Fonction pure.
 */
export function architectureGraph(
  elements: readonly ElementView[],
  genesisId: string,
  center: { readonly x: number; readonly y: number },
  kind: ArchitectureKind,
  links: readonly MapLinkView[],
  measured: readonly MeasuredLinkView[] = []
): ArchitectureGraph {
  const own = elements.filter((element) => element.genesisId === genesisId)
  const tree = treeOf(own, [genesisId])
  const numbers = progression(own, links, measured).numbers
  const visible = own.filter((element) => tree.visible.has(element.id))
  const parents = new Map(own.map((element) => [element.id, element.parentId] as const))
  const depthOf = (id: string): number => {
    let depth = 1
    for (let parent = parents.get(id); parent !== undefined && parents.has(parent) && depth < 100; depth++)
      parent = parents.get(parent)
    return depth
  }
  const { width: W, height: H } = ELEMENT_SIZE
  const layers = ARCHITECTURES[kind].layers
  const known = new Set(layers.map((entry) => entry.id))
  const groups: { readonly layer: string | null; readonly label: string; readonly members: ElementView[] }[] = [
    ...layers.map((entry) => ({ layer: entry.id as string | null, label: entry.label, members: [] as ElementView[] })),
    { layer: null, label: 'Non classés', members: [] }
  ]
  for (const element of visible) {
    const layer = element.layer ?? null
    const group = groups.find((entry) => entry.layer === (layer !== null && known.has(layer) ? layer : null))
    group?.members.push(element)
  }
  const width = BAND.label + BAND.columns * W + (BAND.columns - 1) * BAND.gap + 2 * BAND.padding
  const left = center.x - W / 2 - BAND.label - BAND.padding
  const placed: PlacedElement[] = []
  const bands: LayerBand[] = []
  let top = center.y + SPACING.genesis
  for (const group of groups) {
    if (group.layer === null && group.members.length === 0) continue
    const members = [...group.members].sort((a, b) => byNumber(numbers.get(a.id) ?? '', numbers.get(b.id) ?? ''))
    const rows = Math.ceil(members.length / BAND.columns)
    const height = rows === 0 ? BAND.empty : rows * H + (rows - 1) * SPACING.down + 2 * BAND.padding
    members.forEach((element, index) => {
      const column = index % BAND.columns
      const row = Math.floor(index / BAND.columns)
      placed.push({
        element,
        depth: depthOf(element.id),
        number: numbers.get(element.id) ?? '',
        x: left + BAND.label + BAND.padding + column * (W + BAND.gap) + W / 2,
        y: top + BAND.padding + row * (H + SPACING.down) + H / 2
      })
    })
    bands.push({
      id: `band-${genesisId}-${group.layer ?? 'aucune'}`,
      genesisId,
      layer: group.layer,
      label: group.label,
      count: members.length,
      x: left + width / 2,
      y: top + height / 2,
      width,
      height
    })
    top += height
  }
  const byId = new Map(own.map((element) => [element.id, element] as const))
  const visibleEnd = (id: string): string | null => {
    let current = byId.get(id)
    for (let guard = 0; current !== undefined && guard < 100; guard++) {
      if (tree.visible.has(current.id)) return current.id
      current = byId.get(current.parentId)
    }
    return null
  }
  const edges = linkEdges(links, measured, visibleEnd, () => true, false).map((edge) => {
    const dependency = edge.kind === 'measured' || (edge.relation !== null && DEPENDENCY_RELATIONS.has(edge.relation))
    const from = byId.get(edge.source)?.layer ?? null
    const to = byId.get(edge.target)?.layer ?? null
    return { ...edge, violation: dependency && isViolation(kind, from, to) }
  })
  return { placed, edges, bands }
}
