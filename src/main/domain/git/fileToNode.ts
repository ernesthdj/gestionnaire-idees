/**
 * Fichier du dépôt → nœud visible de l'explorateur (spec 021 T030, research R13). Le fichier se cherche dans l'arbre de
 * la cartographie (spec 017) : son nœud `f:`, sinon son dossier le plus profond connu (`d:`, un fichier supprimé ou non
 * analysé) ; on remonte alors jusqu'au premier nœud affiché. Un fichier posé directement dans le nœud ouvert va au
 * nœud « Racine » (`r:<parent>`). Pur.
 */

export interface NodeTree {
  has(key: string): boolean
  /** Parent d'un nœud (`''` : la racine ; `null` : inconnu). */
  parent(key: string): string | null
}

const RACINE = 'r:'

/** Nœud de départ d'un chemin : le fichier, sinon le dossier connu le plus profond. */
function startOf(path: string, tree: NodeTree): string | null {
  if (tree.has(`f:${path}`)) return `f:${path}`
  const parts = path.split('/').slice(0, -1)
  for (let depth = parts.length; depth > 0; depth -= 1) {
    const key = `d:${parts.slice(0, depth).join('/')}`
    if (tree.has(key)) return key
  }
  return null
}

export function fileToNode(path: string, visible: ReadonlySet<string>, tree: NodeTree): string | null {
  let current = startOf(path.replace(/\\/g, '/'), tree)
  for (let guard = 0; current !== null && current !== '' && guard < 200; guard += 1) {
    if (visible.has(current)) return current
    const parent = tree.parent(current)
    if (parent === null) return null
    if (current.startsWith('f:') && visible.has(`${RACINE}${parent}`)) return `${RACINE}${parent}`
    current = parent
  }
  return null
}
