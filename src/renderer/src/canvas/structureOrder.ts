import type { ElementView, MapLinkView, MeasuredLinkView } from '@shared/ipc/canvas'

/**
 * Ordre de progression d'une carte de structure (spec 017 D17) : entre frères, l'ordre donné par Claude (`order`),
 * sinon celui des dépendances (ce dont les autres dépendent passe d'abord), sinon celui du dessin ; puis le numéro de
 * chaque élément (1, 1.2, 1.2.1…). Fonctions pures.
 */

export interface Progression {
  /** Enfants de chaque parent (genesis ou élément), dans l'ordre de progression. */
  readonly children: ReadonlyMap<string, readonly ElementView[]>
  /** Numéro de progression de chaque élément. */
  readonly numbers: ReadonlyMap<string, string>
}

/** Relations où la cible se construit avant la source (`a depend_de b` : b d'abord) ; `bloque` : la source d'abord. */
const TARGET_FIRST = new Set(['depend_de', 'appelle', 'lit_ecrit', 'implemente', 'teste'])

export function progression(
  elements: readonly ElementView[],
  links: readonly MapLinkView[] = [],
  measured: readonly MeasuredLinkView[] = []
): Progression {
  const byId = new Map(elements.map((element) => [element.id, element] as const))
  const drawn = new Map(elements.map((element, index) => [element.id, index] as const))
  const chainOf = (id: string): string[] => {
    const chain: string[] = []
    let current = byId.get(id)
    for (let guard = 0; current !== undefined && guard < 100; guard++) {
      chain.unshift(current.id)
      current = byId.get(current.parentId)
    }
    return chain
  }

  // « before » : pour chaque élément, les frères à placer avant lui (un lien entre descendants remonte sur les frères).
  const before = new Map<string, Set<string>>()
  const require = (first: string, then: string): void => {
    const a = chainOf(first)
    const b = chainOf(then)
    for (let level = 0; level < Math.min(a.length, b.length); level++) {
      const x = a[level] as string
      const y = b[level] as string
      if (x === y) continue
      if (byId.get(x)?.parentId === byId.get(y)?.parentId) before.set(y, (before.get(y) ?? new Set()).add(x))
      return
    }
  }
  for (const link of links) {
    if (link.relation === null || link.from.kind !== 'element' || link.to.kind !== 'element') continue
    if (TARGET_FIRST.has(link.relation)) require(link.to.id, link.from.id)
    else if (link.relation === 'bloque') require(link.from.id, link.to.id)
  }
  for (const link of measured) require(link.to, link.from)

  const grouped = new Map<string, ElementView[]>()
  for (const element of elements) grouped.set(element.parentId, [...(grouped.get(element.parentId) ?? []), element])
  const children = new Map<string, ElementView[]>()
  for (const [parentId, siblings] of grouped) children.set(parentId, ordered(siblings, before, drawn))

  const numbers = new Map<string, string>()
  const number = (parentId: string, prefix: string): void => {
    ;(children.get(parentId) ?? []).forEach((child, index) => {
      const label = prefix === '' ? String(index + 1) : `${prefix}.${index + 1}`
      numbers.set(child.id, label)
      number(child.id, label)
    })
  }
  for (const parentId of children.keys()) if (!byId.has(parentId)) number(parentId, '')
  return { children, numbers }
}

/**
 * Frères ordonnés : ceux que Claude a numérotés d'abord, dans son ordre ; puis les autres par dépendances (tri
 * topologique ; à égalité ou en cycle, l'ordre du dessin).
 */
function ordered(
  siblings: readonly ElementView[],
  before: ReadonlyMap<string, ReadonlySet<string>>,
  drawn: ReadonlyMap<string, number>
): ElementView[] {
  const byDrawing = (a: ElementView, b: ElementView): number => (drawn.get(a.id) ?? 0) - (drawn.get(b.id) ?? 0)
  const numbered = siblings
    .filter((element) => element.order !== null)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || byDrawing(a, b))
  const rest = siblings.filter((element) => element.order === null).sort(byDrawing)
  const pending = new Set(rest.map((element) => element.id))
  const result: ElementView[] = []
  while (pending.size > 0) {
    const ready = rest.find(
      (element) => pending.has(element.id) && [...(before.get(element.id) ?? [])].every((first) => !pending.has(first))
    )
    // Cycle : le premier dessiné passe.
    const next = ready ?? rest.find((element) => pending.has(element.id))
    if (next === undefined) break
    pending.delete(next.id)
    result.push(next)
  }
  return [...numbered, ...result]
}
