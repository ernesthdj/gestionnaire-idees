/** Parcours de l'arbre de croissance d'un neurone (logique pure). */

export interface TreeNode {
  readonly id: string
  readonly parentId: string | null
  readonly depth: number
  readonly title: string
}

/** Chemin racine → cible (inclus) ; vide si la cible est inconnue. */
export function pathTo<T extends TreeNode>(nodes: readonly T[], targetId: string): T[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const path: T[] = []
  let current = byId.get(targetId)
  const seen = new Set<string>()
  while (current !== undefined && !seen.has(current.id)) {
    seen.add(current.id)
    path.unshift(current)
    current = current.parentId === null ? undefined : byId.get(current.parentId)
  }
  return path
}

/** Tous les descendants d'un nœud (sans le nœud lui-même). */
export function descendantsOf<T extends TreeNode>(nodes: readonly T[], id: string): T[] {
  const children = new Map<string, T[]>()
  for (const node of nodes) {
    if (node.parentId === null) continue
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node])
  }
  const result: T[] = []
  const stack = [...(children.get(id) ?? [])]
  while (stack.length > 0) {
    const node = stack.pop()
    if (node === undefined) break
    result.push(node)
    stack.push(...(children.get(node.id) ?? []))
  }
  return result
}

/** Alias courts des nœuds envoyés à l'IA (`s0` = racine, puis ordre de création) : jamais d'identifiant interne. */
export function aliasesOf(nodes: readonly { readonly id: string }[]): Map<string, string> {
  return new Map(nodes.map((node, index) => [node.id, `s${index}`]))
}
