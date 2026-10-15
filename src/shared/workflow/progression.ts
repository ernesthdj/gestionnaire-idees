import type { SpecStatus, WorkflowTreeNode, WorkflowTreeView } from '../ipc/workflow'

/**
 * Progression d'un projet (spec 032 D12, D13, Q3, Q6) : ce que la doc prévoit, ce que le code contient, ce qui est
 * hors plan. Rangée par **familles du Workflow** (un rond de niveau 1 : un L1, ou une spec ou un fichier de tâches sans
 * L1), leurs lots dessous ; le lien au code passe par les chemins cités par les tâches (spec 023 D9), ou par un nom de
 * fichier cité seul (`WindowManager` couvre tout `WindowManager.ts`, Q6). Un test n'est jamais hors plan. Pur, partagé :
 * l'app le calcule à l'affichage depuis l'arbre du Workflow et la carte de l'analyse du code, sans IA.
 */

export type PartKind = 'reel' | 'prevu'

/** Un lot : une spec, un fichier de tâches, ou un document (avec ses tâches, ou sans encore). */
export interface ProgressLot {
  readonly key: string
  readonly title: string
  readonly source: 'spec' | 'taskFile' | 'doc'
  readonly status: SpecStatus | null
  /** Bâti : un fichier cité par ses tâches existe dans le code, toutes ses cases sont faites, ou il est livré. */
  readonly kind: PartKind
  readonly done: number
  readonly total: number
  /** Maturité du brainstorm en % (100 : complet) ; un document mûr sans tâches est « à spécifier » (Q7). */
  readonly maturity: number | null
}

/** Une famille : un rond de niveau 1 du Workflow et ses lots, dans l'ordre de l'arbre. */
export interface ProgressFamily {
  readonly key: string
  readonly title: string
  /** Repère court : `L1f` pour `L1f-reprise-projet.md`, `spec 017`, le nom du fichier de tâches. */
  readonly label: string
  readonly kind: PartKind
  readonly done: number
  readonly total: number
  readonly lots: readonly ProgressLot[]
  /** Terminée (Q7) : chacun de ses lots est livré, abandonné ou a toutes ses cases faites ; rangée dans « ✔ Bâti ». */
  readonly finished: boolean
}

/** Un dossier du code dont des fichiers ne sont cités par aucune tâche (Q6 : le hors plan par dossier). */
export interface StrayFolder {
  readonly path: string
  readonly files: readonly string[]
}

export interface ProgressionView {
  readonly families: readonly ProgressFamily[]
  /** Dossiers hors plan, du plus fourni au moins fourni. */
  readonly strays: readonly StrayFolder[]
  /** Nombre de fichiers hors plan. */
  readonly strayCount: number
  /** Tâches faites et en tout, sur tout le projet. */
  readonly done: number
  readonly total: number
  /** Le code est analysé : sans analyse, un lot n'est bâti que si ses cases sont faites (ou s'il est livré). */
  readonly analysed: boolean
}

export interface ProgressionCode {
  readonly files: readonly { readonly path: string; readonly plumbing: boolean }[]
}

const trimSlash = (path: string): string => path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
const folderOf = (path: string): string => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.')
/** Nom d'un fichier sans dossier ni extension : `src/main/shell/WindowManager.ts` → `WindowManager`. */
const baseName = (path: string): string => (path.split('/').at(-1) ?? path).replace(/\.[^.]+$/, '')
/** Un test accompagne le code qu'il teste : ni prévu ni hors plan. */
const isTest = (path: string): boolean =>
  /(^|\/)(tests?|__tests__)\//.test(path) || /\.(test|spec|e2e)\.[^.]+$/.test(path)

const isFinished = (lot: ProgressLot): boolean =>
  lot.status === 'delivered' || lot.status === 'abandoned' || (lot.total > 0 && lot.done === lot.total)

const titleOf = (node: WorkflowTreeNode): string =>
  node.source === 'spec' ? `${node.key.replace(/^spec:/, '')} · ${node.title}` : node.title

function labelOf(node: WorkflowTreeNode): string {
  if (node.source === 'spec') return `spec ${node.key.replace(/^spec:/, '')}`
  const name = (node.path ?? '').split('/').at(-1)?.replace(/\.md$/, '') ?? ''
  if (node.source === 'doc') return name.split('-')[0] ?? name
  return name
}

/** Carrés d'un nœud, à toute profondeur. */
const squaresIn = (node: WorkflowTreeNode): WorkflowTreeNode[] =>
  node.children.flatMap((child) => (child.kind === 'square' ? [child] : squaresIn(child)))

export function progressionOf(tree: WorkflowTreeView, code: ProgressionCode | null): ProgressionView {
  const files = (code?.files ?? []).filter((file) => !file.plumbing).map((file) => file.path)
  const cited = new Set<string>()
  const citedNames = new Set<string>()

  const lot = (node: WorkflowTreeNode, source: ProgressLot['source'], squares: readonly WorkflowTreeNode[]) => {
    const paths = [...new Set(squares.flatMap((square) => square.files))].map(trimSlash).filter((p) => p !== '')
    const names = [...new Set(squares.flatMap((square) => square.names ?? []))]
    paths.forEach((path) => cited.add(path))
    names.forEach((name) => citedNames.add(name))
    const inCode =
      paths.some((path) => files.some((file) => file === path || file.startsWith(`${path}/`))) ||
      names.some((name) => files.some((file) => baseName(file) === name))
    const done = squares.filter((square) => square.state === 'done').length
    const built = inCode || node.status === 'delivered' || (squares.length > 0 && done === squares.length)
    return {
      key: node.key,
      title: titleOf(node),
      source,
      status: node.status,
      kind: built ? 'reel' : 'prevu',
      done,
      total: squares.length,
      maturity: node.maturity
    } satisfies ProgressLot
  }

  /** Lots sous un rond : une spec ou un fichier de tâches entier ; un document, pour ses propres carrés. */
  const lotsOf = (node: WorkflowTreeNode): ProgressLot[] => {
    if (node.kind !== 'round') return []
    if (node.source === 'spec' || node.source === 'taskFile') return [lot(node, node.source, squaresIn(node))]
    const own = node.children.filter((child) => child.kind === 'square')
    const inner = node.children.flatMap(lotsOf)
    // Un document sans tâches ni lots dessous est un lot vide : prévu, à brainstormer.
    return [...(own.length > 0 || inner.length === 0 ? [lot(node, 'doc', own)] : []), ...inner]
  }

  const families = tree.nodes
    .filter((node) => node.kind === 'round')
    .map((node): ProgressFamily => {
      const all = lotsOf(node)
      // Une famille déjà spécifiée ou découpée en tâches : ses documents sans tâches ne sont plus du prévu, seulement
      // le brainstorm d'où viennent ses lots.
      const planned = all.some((entry) => entry.source !== 'doc' || entry.total > 0)
      const lots = planned ? all.filter((entry) => entry.source !== 'doc' || entry.total > 0) : all
      return {
        key: node.key,
        title: titleOf(node),
        label: labelOf(node),
        kind: lots.some((entry) => entry.kind === 'reel') ? 'reel' : 'prevu',
        done: lots.reduce((sum, entry) => sum + entry.done, 0),
        total: lots.reduce((sum, entry) => sum + entry.total, 0),
        lots,
        finished: lots.length > 0 && lots.every(isFinished)
      }
    })

  // Un fichier est couvert si son nom, lui-même ou l'un de ses dossiers est cité.
  const isCited = (file: string): boolean => {
    if (citedNames.has(baseName(file))) return true
    for (let path = file; path !== ''; path = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')
      if (cited.has(path)) return true
    return false
  }
  const byFolder = new Map<string, string[]>()
  for (const file of files.filter((entry) => !isTest(entry) && !isCited(entry))) {
    const folder = folderOf(file)
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), file])
  }
  const strays = [...byFolder]
    .map(([path, entries]) => ({ path, files: entries }))
    .sort((a, b) => b.files.length - a.files.length || a.path.localeCompare(b.path))

  return {
    families,
    strays,
    strayCount: strays.reduce((sum, folder) => sum + folder.files.length, 0),
    done: families.reduce((sum, family) => sum + family.done, 0),
    total: families.reduce((sum, family) => sum + family.total, 0),
    analysed: code !== null
  }
}
