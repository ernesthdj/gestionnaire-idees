import type { CodeLang, CodeLayer, ExplorerMapView, MapFileView, MapModuleView } from '@shared/ipc/reprise'

/**
 * Carte en boîtes (spec 031 D1-D3), calculs purs : ce qui est montré selon les filtres, et où se place chaque boîte. Les
 * modules sont rangés en colonnes (sens des appels, donné par le main) ; une boîte ouverte s'agrandit sur place et
 * pousse celles d'en dessous ; au-delà de `BIG_MODULE` fichiers, elle montre une liste filtrable au lieu de boîtes.
 */

export const BOX = {
  margin: 24,
  width: 240,
  openWidth: 310,
  height: 140,
  gapX: 90,
  gapY: 28,
  /** Haut d'une boîte ouverte (couche, nom, rôle) avant ses fichiers. */
  header: 150,
  fileHeight: 54,
  fileGap: 8,
  padding: 12,
  filterHeight: 46,
  rowHeight: 30,
  listRows: 8
} as const

/** Au-delà de ce nombre de fichiers, une boîte ouverte montre une liste filtrable (spec 031 D3). */
export const BIG_MODULE = 6

const LAYER_ORDER: Readonly<Record<CodeLayer, number>> = { start: 0, entry: 1, rules: 2, data: 3 }

export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface ShownBoxes {
  readonly modules: readonly MapModuleView[]
  /** Fichiers montrés de chaque module (filtres appliqués). */
  readonly filesOf: ReadonlyMap<string, readonly MapFileView[]>
}

/** Ce que les filtres laissent voir : sans la plomberie (si masquée), dans un langage ; un module vide disparaît. */
export function shownBoxes(map: ExplorerMapView, hidePlumbing: boolean, lang: CodeLang | null): ShownBoxes {
  const filesOf = new Map<string, MapFileView[]>()
  for (const file of map.files) {
    if (hidePlumbing && file.plumbing) continue
    if (lang !== null && file.lang !== lang) continue
    filesOf.set(file.moduleKey, [...(filesOf.get(file.moduleKey) ?? []), file])
  }
  const modules = map.modules.filter(
    (module) => !(hidePlumbing && module.plumbing) && (filesOf.get(module.key)?.length ?? 0) > 0
  )
  return { modules, filesOf }
}

/** Une boîte ouverte montre ses fichiers en boîtes (petit module) ou en liste (gros module). */
export const isBig = (files: readonly MapFileView[]): boolean => files.length > BIG_MODULE

/** Clés montrées sur la carte : les modules, et les fichiers des petits modules ouverts (marques de la spec 021). */
export function shownKeys(shown: ShownBoxes, open: ReadonlySet<string>): string[] {
  const keys: string[] = []
  for (const module of shown.modules) {
    keys.push(module.key)
    const files = shown.filesOf.get(module.key) ?? []
    if (open.has(module.key) && !isBig(files)) keys.push(...files.map((file) => file.key))
  }
  return keys
}

export interface BoxLayout {
  readonly modules: ReadonlyMap<string, Rect>
  /** Fichiers des petits modules ouverts, placés dans leur boîte (coordonnées relatives à elle). */
  readonly files: ReadonlyMap<string, Rect>
}

export function boxLayout(shown: ShownBoxes, open: ReadonlySet<string>): BoxLayout {
  const columns = new Map<number, MapModuleView[]>()
  for (const module of shown.modules) columns.set(module.column, [...(columns.get(module.column) ?? []), module])
  const modules = new Map<string, Rect>()
  const files = new Map<string, Rect>()
  let x: number = BOX.margin
  for (const column of [...columns.keys()].sort((a, b) => a - b)) {
    const members = [...(columns.get(column) ?? [])].sort(
      (a, b) => LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer] || a.title.localeCompare(b.title)
    )
    let y: number = BOX.margin
    let width: number = BOX.width
    for (const module of members) {
      const own = shown.filesOf.get(module.key) ?? []
      const isOpen = open.has(module.key)
      const big = isBig(own)
      const height = !isOpen
        ? BOX.height
        : big
          ? BOX.header + BOX.filterHeight + Math.min(own.length, BOX.listRows) * BOX.rowHeight + BOX.padding
          : BOX.header + own.length * (BOX.fileHeight + BOX.fileGap) + BOX.padding
      const rect = { x, y, width: isOpen ? BOX.openWidth : BOX.width, height }
      modules.set(module.key, rect)
      if (isOpen && !big) {
        own.forEach((file, index) => {
          files.set(file.key, {
            x: BOX.padding,
            y: BOX.header + index * (BOX.fileHeight + BOX.fileGap),
            width: rect.width - 2 * BOX.padding,
            height: BOX.fileHeight
          })
        })
      }
      width = Math.max(width, rect.width)
      y += height + BOX.gapY
    }
    x += width + BOX.gapX
  }
  return { modules, files }
}
