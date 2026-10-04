import type { DessinerInput } from '@shared/mcp/tools'
import { MCP_LIMITS } from '@shared/mcp/tools'

/** Élément existant de la carte auquel un lot peut se rattacher (spec 007). */
export type ExistingKind = 'idea' | 'note' | 'frame' | 'other'

/** Référence résolue : un nœud du lot (par sa clé) ou un élément existant (par son identifiant). */
export type ResolvedRef =
  | { readonly kind: 'key'; readonly key: string }
  | { readonly kind: 'existing'; readonly id: string; readonly existing: ExistingKind }

export interface ResolvedNode {
  readonly key: string
  readonly title: string
  readonly text: string | null
  readonly type: 'note' | 'idee'
  readonly parent: ResolvedRef | null
  /** Profondeur dans le lot (0 : sans parent dans le lot). */
  readonly depth: number
}

export interface ResolvedLink {
  readonly from: ResolvedRef
  readonly to: ResolvedRef
  readonly label: string | null
}

export interface ResolvedBatch {
  readonly nodes: readonly ResolvedNode[]
  readonly links: readonly ResolvedLink[]
}

export type BatchProblem =
  | { readonly code: 'LOT_TROP_GROS'; readonly message: string }
  | { readonly code: 'LOT_INVALIDE'; readonly message: string }
  | { readonly code: 'INTROUVABLE'; readonly message: string }

/**
 * Résout un lot `dessiner` (spec 007 FR-007, FR-008) : clés uniques, parents et liens vers une clé du lot ou un
 * élément existant, aucun cycle, aucun auto-lien. Rien n'est écrit : un seul problème suffit à refuser tout le lot.
 */
export function resolveBatch(
  input: DessinerInput,
  existing: (id: string) => ExistingKind | undefined
): { readonly ok: true; readonly batch: ResolvedBatch } | { readonly ok: false; readonly problem: BatchProblem } {
  const links = input.liens ?? []
  if (input.noeuds.length > MCP_LIMITS.nodesPerBatch || links.length > MCP_LIMITS.linksPerBatch) {
    return {
      ok: false,
      problem: {
        code: 'LOT_TROP_GROS',
        message: `${input.noeuds.length} nœuds et ${links.length} liens : maximum ${MCP_LIMITS.nodesPerBatch} nœuds et ${MCP_LIMITS.linksPerBatch} liens par lot, découpe-le.`
      }
    }
  }
  const invalid = (message: string) => ({ ok: false as const, problem: { code: 'LOT_INVALIDE' as const, message } })

  const keys = new Map<string, number>()
  for (const [index, node] of input.noeuds.entries()) {
    if (keys.has(node.cle))
      return invalid(`noeuds[${index}].cle : la clé « ${node.cle} » est déjà utilisée dans le lot`)
    keys.set(node.cle, index)
  }

  const resolve = (ref: string, where: string): ResolvedRef | BatchProblem => {
    if (keys.has(ref)) return { kind: 'key', key: ref }
    const kind = existing(ref)
    if (kind !== undefined) return { kind: 'existing', id: ref, existing: kind }
    return /^[0-9a-f-]{36}$/i.test(ref)
      ? { code: 'INTROUVABLE', message: `${where} : élément ${ref} introuvable (retiré ou annulé ?)` }
      : { code: 'LOT_INVALIDE', message: `${where} : clé « ${ref} » absente du lot` }
  }
  const isProblem = (value: ResolvedRef | BatchProblem): value is BatchProblem => 'code' in value

  const parents = new Map<string, ResolvedRef | null>()
  for (const [index, node] of input.noeuds.entries()) {
    if (node.parent === undefined) {
      parents.set(node.cle, null)
      continue
    }
    if (node.parent === node.cle) return invalid(`noeuds[${index}].parent : un nœud ne peut pas être son propre parent`)
    const parent = resolve(node.parent, `noeuds[${index}].parent`)
    if (isProblem(parent)) return { ok: false, problem: parent }
    if (parent.kind === 'existing' && parent.existing === 'other') {
      return invalid(`noeuds[${index}].parent : seule une note, un cadre ou une idée peut porter des nœuds`)
    }
    parents.set(node.cle, parent)
  }

  // Profondeur et cycles : on remonte la chaîne des parents internes au lot.
  const depths = new Map<string, number>()
  const depthOf = (key: string, seen: Set<string>): number | null => {
    const known = depths.get(key)
    if (known !== undefined) return known
    if (seen.has(key)) return null
    seen.add(key)
    const parent = parents.get(key) ?? null
    const depth = parent === null || parent.kind === 'existing' ? 0 : depthOf(parent.key, seen)
    if (depth === null) return null
    const own = parent === null || parent.kind === 'existing' ? 0 : depth + 1
    depths.set(key, own)
    return own
  }
  for (const node of input.noeuds) {
    if (depthOf(node.cle, new Set()) === null) return invalid(`noeuds : cycle de parents autour de « ${node.cle} »`)
  }

  const resolvedLinks: ResolvedLink[] = []
  for (const [index, link] of links.entries()) {
    if (link.de === link.vers) return invalid(`liens[${index}] : un lien relie deux éléments différents`)
    const from = resolve(link.de, `liens[${index}].de`)
    if (isProblem(from)) return { ok: false, problem: from }
    const to = resolve(link.vers, `liens[${index}].vers`)
    if (isProblem(to)) return { ok: false, problem: to }
    resolvedLinks.push({ from, to, label: link.libelle === undefined || link.libelle === '' ? null : link.libelle })
  }

  return {
    ok: true,
    batch: {
      nodes: input.noeuds.map((node) => ({
        key: node.cle,
        title: node.titre,
        text: node.texte === undefined || node.texte === '' ? null : node.texte,
        type: node.type ?? 'note',
        parent: parents.get(node.cle) ?? null,
        depth: depths.get(node.cle) ?? 0
      })),
      links: resolvedLinks
    }
  }
}
