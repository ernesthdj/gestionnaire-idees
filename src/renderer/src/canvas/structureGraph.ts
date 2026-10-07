import type { ElementRelation, ElementView, MapLinkView, MeasuredLinkView } from '@shared/ipc/canvas'
import { weakestProvenance, type LinkProvenance } from '@shared/ipc/reprise'
import { progression } from './structureOrder'

/**
 * Carte de structure d'un projet à l'écran (spec 009, L3 §5 ; spec 017 D15, D17) : quels éléments sont visibles
 * (repli), où ils se placent (disposition alternée : modules en colonne sous le genesis, enfants d'un niveau impair en
 * ligne à droite, d'un niveau pair en colonne dessous, dans l'ordre de progression), et quels liens tracer selon le
 * focus — au repos, ceux entre éléments de niveau 1, agrégés ; pour l'élément en focus, ses propres liens, rattachés à
 * l'élément visible de l'autre bout. Fonctions pures.
 */

/** Taille d'un élément (D18) : en-tête sur une ligne, titre et résumé sur deux lignes chacun, pied pour les chemins. */
export const ELEMENT_SIZE = { width: 304, height: 144 } as const
/**
 * Espacement (D17) : entre deux frères d'une ligne (`across`) ou d'une colonne (`down`), en plus entre deux modules de
 * niveau 1 (`module`), et du centre du genesis au premier module (`genesis`).
 */
export const SPACING = { across: 96, down: 48, module: 72, genesis: 120 } as const

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
  const { width: W, height: H } = ELEMENT_SIZE
  // Boîte d'un sous-arbre posé à (x, y) (coin haut gauche) : les enfants d'un niveau impair partent en ligne à droite,
  // ceux d'un niveau pair en colonne dessous ; chaque enfant occupe toute sa boîte, donc rien ne se chevauche.
  const layout = (element: ElementView, depth: number, x: number, y: number): { width: number; height: number } => {
    placed.push({ element, depth, number: order.numbers.get(element.id) ?? '', x: x + W / 2, y: y + H / 2 })
    const kids = visibleKids(element)
    chain(element.id, kids)
    let width: number = W
    let height: number = H
    if (depth % 2 === 1) {
      let cursor = x + W + SPACING.across
      for (const kid of kids) {
        const box = layout(kid, depth + 1, cursor, y)
        cursor += box.width + SPACING.across
        height = Math.max(height, box.height)
      }
      if (kids.length > 0) width = cursor - SPACING.across - x
    } else {
      let cursor = y + H + SPACING.down
      for (const kid of kids) {
        const box = layout(kid, depth + 1, x, cursor)
        cursor += box.height + SPACING.down
        width = Math.max(width, box.width)
      }
      if (kids.length > 0) height = cursor - SPACING.down - y
    }
    return { width, height }
  }
  // Les modules (niveau 1) descendent sous le genesis, alignés sur lui, avec de l'air en plus entre deux modules.
  for (const genesisId of genesisIds) {
    const center = genesisCenters.get(genesisId) as { x: number; y: number }
    const modules = visibleKids({ id: genesisId })
    chain(genesisId, modules)
    let cursor = center.y + SPACING.genesis
    for (const module of modules) {
      cursor += layout(module, 1, center.x - W / 2, cursor).height + SPACING.down + SPACING.module
    }
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
