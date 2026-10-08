import { weakestProvenance as weakest, type LinkProvenance } from '@shared/ipc/reprise'
import { coveringElement, normalizeElementPath } from '@shared/structure/covers'

export { covers, normalizeElementPath } from '@shared/structure/covers'

/**
 * Appels mesurés entre les éléments d'une carte de structure (spec 017 US7, FR-033) : les appels résolus de l'analyse,
 * agrégés de fichier à fichier, puis projetés sur les éléments dont les chemins couvrent ces fichiers. Pur.
 */

/** Appels d'un fichier vers un autre : nombre cumulé, fiabilité la plus faible. */
export interface FileCall {
  readonly from: string
  readonly to: string
  readonly count: number
  readonly provenance: LinkProvenance
}

export interface MeasuredElement {
  readonly id: string
  readonly parentId: string
  readonly paths: readonly string[]
}

export interface MeasuredLink {
  readonly from: string
  readonly to: string
  readonly count: number
  readonly provenance: LinkProvenance
}

/** Appels résolus entre fichiers différents, agrégés par paire (ordre stable). */
export function fileCalls(
  edges: readonly {
    readonly fromSymbolId: string
    readonly toSymbolId: string | null
    readonly count: number
    readonly provenance: LinkProvenance
  }[],
  pathOf: (symbolId: string) => string | undefined
): FileCall[] {
  const pairs = new Map<string, FileCall>()
  for (const edge of edges) {
    if (edge.toSymbolId === null) continue
    const from = pathOf(edge.fromSymbolId)
    const to = pathOf(edge.toSymbolId)
    if (from === undefined || to === undefined || from === to) continue
    const key = `${from}\u0000${to}`
    const existing = pairs.get(key)
    pairs.set(key, {
      from,
      to,
      count: (existing?.count ?? 0) + edge.count,
      provenance: existing === undefined ? edge.provenance : weakest(existing.provenance, edge.provenance)
    })
  }
  return [...pairs.values()]
}

/**
 * Projette les appels entre fichiers sur les éléments : un fichier revient à l'élément le plus profond qui le couvre
 * (à profondeur égale, le chemin le plus précis) ; les appels internes à un élément ne sont pas des liens.
 */
export function measuredLinks(elements: readonly MeasuredElement[], calls: readonly FileCall[]): MeasuredLink[] {
  const byId = new Map(elements.map((element) => [element.id, element] as const))
  const depthOf = (element: MeasuredElement): number => {
    let depth = 0
    for (let parent = byId.get(element.parentId); parent !== undefined && depth < 100; depth++) {
      parent = byId.get(parent.parentId)
    }
    return depth
  }
  const candidates = elements.map((element) => ({
    id: element.id,
    depth: depthOf(element),
    paths: element.paths.map(normalizeElementPath).filter((path) => path !== '')
  }))
  const owners = new Map<string, string | null>()
  const ownerOf = (file: string): string | null => {
    const known = owners.get(file)
    if (known !== undefined) return known
    const owner = coveringElement(candidates, file)
    owners.set(file, owner)
    return owner
  }
  const links = new Map<string, MeasuredLink>()
  for (const call of calls) {
    const from = ownerOf(call.from)
    const to = ownerOf(call.to)
    if (from === null || to === null || from === to) continue
    const key = `${from}>${to}`
    const existing = links.get(key)
    links.set(key, {
      from,
      to,
      count: (existing?.count ?? 0) + call.count,
      provenance: existing === undefined ? call.provenance : weakest(existing.provenance, call.provenance)
    })
  }
  return [...links.values()]
}
