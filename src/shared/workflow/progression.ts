import type { SpecStatus, WorkflowTreeNode, WorkflowTreeView } from '../ipc/workflow'

/**
 * Progression d'un projet (spec 032 D12, D13, Q3) : ce que la doc prévoit, ce que le code contient, ce qui est hors
 * plan. Le lien passe par les chemins cités par les tâches (spec 023 D9). Pur, partagé : l'app le calcule à
 * l'affichage depuis l'arbre du Workflow et la carte de l'analyse du code, sans IA.
 */

export type PartKind = 'reel' | 'prevu'

/** Une partie : un rond du Workflow qui porte des carrés (user story, socle, lot, groupe), ou un document sans tâches. */
export interface ProgressPart {
  readonly key: string
  readonly title: string
  readonly kind: PartKind
  readonly done: number
  readonly total: number
  /** Module du code de la plupart de ses fichiers ; `null` : aucun fichier dans le code. */
  readonly moduleKey: string | null
  /** Fichiers du code qu'elle couvre (chemins cités qui existent). */
  readonly files: readonly string[]
}

/** Un lot du Workflow (lecture C) : une spec, un fichier de tâches ou un document sans tâches, dans l'ordre de l'arbre. */
export interface ProgressLot {
  readonly key: string
  readonly title: string
  readonly source: 'spec' | 'taskFile' | 'doc'
  readonly status: SpecStatus | null
  readonly done: number
  readonly total: number
  readonly parts: readonly ProgressPart[]
}

/** Un module du code (réel) ou un lot dont rien n'est encore dans le code (prévu) : lectures A et B. */
export interface ProgressGroup {
  readonly key: string
  readonly title: string
  readonly kind: PartKind
  /** Colonne d'appel du module (0 : rien ne l'appelle) ; `null` pour un groupe prévu. */
  readonly column: number | null
  readonly done: number
  readonly total: number
  readonly parts: readonly ProgressPart[]
  /** Fichiers hors plan du module : dans le code, cités par aucune tâche. */
  readonly strays: readonly string[]
}

export interface ProgressionView {
  readonly lots: readonly ProgressLot[]
  readonly groups: readonly ProgressGroup[]
  /** Nombre de fichiers hors plan. */
  readonly strays: number
  /** Le code est analysé : sans analyse, une partie n'est réelle que si toutes ses cases sont faites. */
  readonly analysed: boolean
}

export interface ProgressionCode {
  readonly modules: readonly { readonly key: string; readonly title: string; readonly column: number }[]
  readonly files: readonly { readonly path: string; readonly moduleKey: string; readonly plumbing: boolean }[]
}

const trimSlash = (path: string): string => path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')

/** Un chemin cité couvre un fichier, ou tout un dossier. */
const covers = (cited: string, file: string): boolean => {
  const base = trimSlash(cited)
  return base !== '' && (file === base || file.startsWith(`${base}/`))
}

const sum = (parts: readonly ProgressPart[]): { readonly done: number; readonly total: number } =>
  parts.reduce((acc, part) => ({ done: acc.done + part.done, total: acc.total + part.total }), { done: 0, total: 0 })

export function progressionOf(tree: WorkflowTreeView, code: ProgressionCode | null): ProgressionView {
  const files = code?.files ?? []
  const moduleOf = new Map(files.map((file) => [file.path, file.moduleKey] as const))
  const cited = new Set<string>()

  const part = (node: WorkflowTreeNode, title: string, squares: readonly WorkflowTreeNode[]): ProgressPart => {
    const paths = [...new Set(squares.flatMap((square) => square.files))]
    paths.forEach((path) => cited.add(path))
    const existing = files.filter((file) => paths.some((path) => covers(path, file.path))).map((file) => file.path)
    const votes = new Map<string, number>()
    for (const path of existing) {
      const key = moduleOf.get(path)
      if (key !== undefined) votes.set(key, (votes.get(key) ?? 0) + 1)
    }
    // Le module le plus cité ; à égalité, le premier rencontré (ordre des fichiers de l'analyse).
    let moduleKey: string | null = null
    for (const [key, count] of votes) if (moduleKey === null || count > (votes.get(moduleKey) ?? 0)) moduleKey = key
    const done = squares.filter((square) => square.state === 'done').length
    const built = existing.length > 0 || (squares.length > 0 && done === squares.length)
    return {
      key: node.key,
      title,
      kind: built ? 'reel' : 'prevu',
      done,
      total: squares.length,
      moduleKey,
      files: existing
    }
  }

  /** Parties sous un rond : lui-même s'il porte des carrés, puis ses ronds intérieurs. */
  const partsOf = (node: WorkflowTreeNode, own: string): ProgressPart[] => {
    const squares = node.children.filter((child) => child.kind === 'square')
    return [
      ...(squares.length === 0 ? [] : [part(node, own, squares)]),
      ...node.children.filter((child) => child.kind === 'round').flatMap((child) => partsOf(child, child.title))
    ]
  }

  const lots: ProgressLot[] = []
  const walk = (node: WorkflowTreeNode): void => {
    if (node.kind !== 'round') return
    if (node.source === 'spec' || node.source === 'taskFile') {
      const parts = partsOf(node, node.source === 'spec' ? 'Socle' : node.title)
      lots.push({ key: node.key, title: node.title, source: node.source, status: node.status, ...sum(parts), parts })
      return
    }
    if (node.source === 'doc' && node.children.length === 0) {
      lots.push({ key: node.key, title: node.title, source: 'doc', status: null, done: 0, total: 0, parts: [] })
      return
    }
    node.children.forEach(walk)
  }
  tree.nodes.forEach(walk)

  const allParts = lots.flatMap((lot) => lot.parts)
  // Un fichier est couvert si lui ou l'un de ses dossiers est cité.
  const citedPaths = new Set([...cited].map(trimSlash))
  const isCited = (file: string): boolean => {
    for (let path = file; path !== ''; path = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')
      if (citedPaths.has(path)) return true
    return false
  }
  const strayFiles = files.filter((file) => !file.plumbing && !isCited(file.path))
  const modules: ProgressGroup[] = [...(code?.modules ?? [])]
    .sort((a, b) => a.column - b.column || a.title.localeCompare(b.title))
    .flatMap((module): ProgressGroup[] => {
      const parts = allParts.filter((entry) => entry.moduleKey === module.key)
      const strays = strayFiles.filter((file) => file.moduleKey === module.key).map((file) => file.path)
      if (parts.length === 0 && strays.length === 0) return []
      return [
        { key: module.key, title: module.title, kind: 'reel', column: module.column, ...sum(parts), parts, strays }
      ]
    })
  const planned = lots.flatMap((lot): ProgressGroup[] => {
    const parts = lot.parts.filter((entry) => entry.moduleKey === null)
    if (parts.length === 0 && lot.parts.length > 0) return []
    return [
      {
        key: lot.key,
        title: lot.title,
        kind: parts.some((entry) => entry.kind === 'reel') ? 'reel' : 'prevu',
        column: null,
        ...sum(parts),
        parts,
        strays: []
      }
    ]
  })
  return { lots, groups: [...modules, ...planned], strays: strayFiles.length, analysed: code !== null }
}
