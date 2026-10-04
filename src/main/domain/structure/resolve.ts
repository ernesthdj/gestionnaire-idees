import type { ElementRelation, ElementStatus, ElementType } from '@shared/ipc/canvas'
import { STRUCTURE_LIMITS, type StructureDessinerInput } from '@shared/mcp/tools'

export interface ResolvedElement {
  readonly key: string
  readonly type: ElementType
  readonly title: string
  readonly summary: string | null
  readonly status: ElementStatus | null
  readonly paths: readonly string[] | null
  /** Clé du parent ; `null` : niveau 1 (enfant du genesis). */
  readonly parentKey: string | null
}

export interface ResolvedStructureLink {
  readonly fromKey: string
  readonly toKey: string
  readonly relation: ElementRelation
  readonly label: string | null
}

export type StructureProblem = { readonly code: 'LOT_TROP_GROS' | 'LOT_INVALIDE'; readonly message: string }

/**
 * Résout un lot `structure_dessiner` (spec 009, L3 §2) : clés uniques, parent = clé du lot ou d'un élément existant
 * (absent = niveau 1), aucun cycle même en tenant compte des parents déjà enregistrés, liens entre clés connues, sans
 * auto-lien. `existing` : parent actuel de chaque élément du projet, par clé. Rien n'est écrit ici.
 */
export function resolveStructure(
  input: StructureDessinerInput,
  existing: ReadonlyMap<string, string | null>
):
  | {
      readonly ok: true
      readonly elements: readonly ResolvedElement[]
      readonly links: readonly ResolvedStructureLink[]
    }
  | { readonly ok: false; readonly problem: StructureProblem } {
  const links = input.liens ?? []
  if (input.elements.length > STRUCTURE_LIMITS.elements || links.length > STRUCTURE_LIMITS.links) {
    return {
      ok: false,
      problem: {
        code: 'LOT_TROP_GROS',
        message: `${input.elements.length} éléments et ${links.length} liens : maximum ${STRUCTURE_LIMITS.elements} éléments et ${STRUCTURE_LIMITS.links} liens par appel, découpe la carte.`
      }
    }
  }
  const invalid = (message: string) => ({ ok: false as const, problem: { code: 'LOT_INVALIDE' as const, message } })
  const inBatch = new Set<string>()
  for (const [index, element] of input.elements.entries()) {
    if (inBatch.has(element.cle)) return invalid(`elements[${index}].cle : « ${element.cle} » apparaît deux fois`)
    inBatch.add(element.cle)
  }
  const known = (key: string): boolean => inBatch.has(key) || existing.has(key)

  const parents = new Map(existing)
  for (const [index, element] of input.elements.entries()) {
    if (element.parent === undefined) {
      parents.set(element.cle, null)
      continue
    }
    if (element.parent === element.cle)
      return invalid(`elements[${index}].parent : un élément ne peut pas être son propre parent`)
    if (!known(element.parent))
      return invalid(`elements[${index}].parent : clé « ${element.parent} » inconnue (ni dans le lot, ni sur la carte)`)
    parents.set(element.cle, element.parent)
  }
  for (const key of inBatch) {
    const seen = new Set<string>()
    let current: string | null | undefined = key
    while (current !== null && current !== undefined) {
      if (seen.has(current)) return invalid(`elements : cycle de parents autour de « ${key} »`)
      seen.add(current)
      current = parents.get(current)
    }
  }

  const resolvedLinks: ResolvedStructureLink[] = []
  for (const [index, link] of links.entries()) {
    if (link.de === link.vers) return invalid(`liens[${index}] : un lien relie deux éléments différents`)
    if (!known(link.de)) return invalid(`liens[${index}].de : clé « ${link.de} » inconnue`)
    if (!known(link.vers)) return invalid(`liens[${index}].vers : clé « ${link.vers} » inconnue`)
    resolvedLinks.push({
      fromKey: link.de,
      toKey: link.vers,
      relation: link.relation,
      label: link.libelle === undefined || link.libelle === '' ? null : link.libelle
    })
  }

  return {
    ok: true,
    elements: input.elements.map((element) => ({
      key: element.cle,
      type: element.type,
      title: element.titre,
      summary: element.resume === undefined || element.resume === '' ? null : element.resume,
      status: element.statut ?? null,
      paths: element.chemins ?? null,
      parentKey: element.parent ?? null
    })),
    links: resolvedLinks
  }
}
