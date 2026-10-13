import type { ElementStatus } from '@shared/ipc/canvas'

const DONE: ReadonlySet<ElementStatus> = new Set(['livree', 'faite'])

export interface ElementProgressState {
  readonly status: ElementStatus | null
  readonly progress: number | null
  readonly note: string | null
}

/**
 * Avancement après un changement de statut à la main (spec 030 D3) : livrée → 100 %, reste effacé ; à faire →
 * avancement effacé ; quitter livrée ou faite efface un 100 % (un élément rouvert n'affiche pas 100 %), un avancement
 * partiel est gardé. Pur.
 */
export function manualProgress(current: ElementProgressState, status: ElementStatus): ElementProgressState {
  if (DONE.has(status)) return { status, progress: 100, note: null }
  if (status === 'a_faire') return { status, progress: null, note: current.note }
  const reopened = current.status !== null && DONE.has(current.status) && current.progress === 100
  return { status, progress: reopened ? null : current.progress, note: current.note }
}

/** Chemin comparable : séparateurs `/`, sans `./` de tête, sans `/`, `/*` ni `/**` de fin. */
const normalize = (path: string): string =>
  path
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/, '')
    .replace(/\/\*{1,2}$/, '')
    .replace(/\/+$/, '')

export interface CoverableElement {
  readonly id: string
  readonly parentId: string
  readonly status: ElementStatus | null
  readonly paths: readonly string[]
}

/**
 * Éléments qu'un commit couvre (spec 030 D5, D6) : feuilles (sans sous-élément), ni livrées ni faites, dont un chemin
 * est l'un des fichiers commités ou l'un de leurs dossiers parents. Un élément sans chemin n'est jamais couvert. Ordre
 * d'entrée gardé. Pur.
 */
export function coveredElements<T extends CoverableElement>(elements: readonly T[], files: readonly string[]): T[] {
  const parents = new Set(elements.map((element) => element.parentId))
  const committed = files.map(normalize).filter((file) => file !== '')
  return elements.filter((element) => {
    if (parents.has(element.id) || (element.status !== null && DONE.has(element.status))) return false
    return element.paths
      .map(normalize)
      .filter((path) => path !== '')
      .some((path) => committed.some((file) => file === path || file.startsWith(`${path}/`)))
  })
}
