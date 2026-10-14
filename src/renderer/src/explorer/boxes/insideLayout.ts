import type { MapCallView, MapFileView } from '@shared/ipc/reprise'
import type { Rect } from './boxLayout'

/**
 * Intérieur d'un module (spec 031 D5), calcul pur : un cadre à la taille de son contenu, avec de l'air ; les fichiers en
 * colonnes par profondeur d'appel (qui appelle à gauche), 7 par colonne au plus ; les appels vers l'extérieur réduits à
 * des amorces sur les bords — à gauche les modules qui l'appellent, à droite ceux qu'il appelle.
 */

export const INSIDE = {
  stubWidth: 160,
  stubHeight: 30,
  stubGap: 62,
  sideGap: 72,
  padding: 44,
  /** Haut du cadre (couche, nom, rôle) avant les fichiers. */
  top: 118,
  rowHeight: 104,
  fileHeight: 66,
  columnWidth: 220,
  columnGap: 96,
  rowsPerColumn: 7,
  minWidth: 520,
  minHeight: 300
} as const

export interface InsideStub {
  /** Clé du module voisin (`m:…`). */
  readonly moduleKey: string
  readonly side: 'in' | 'out'
  /** Place de l'amorce dans le cadre (coordonnées relatives au cadre). */
  readonly rect: Rect
}

export interface InsideLayout {
  /** Taille du cadre (sa place sur la carte est l'affaire de la vue). */
  readonly width: number
  readonly height: number
  /** Fichiers, placés dans le cadre. */
  readonly files: ReadonlyMap<string, Rect>
  readonly stubs: readonly InsideStub[]
}

/** Modules reliés au module ouvert : qui l'appelle (amorces de gauche), ce qu'il appelle (amorces de droite). */
export function neighboursOf(
  moduleKey: string,
  calls: readonly MapCallView[],
  moduleOf: ReadonlyMap<string, string>
): { readonly callers: string[]; readonly callees: string[] } {
  const callers: string[] = []
  const callees: string[] = []
  for (const call of calls) {
    const from = moduleOf.get(call.from)
    const to = moduleOf.get(call.to)
    if (from === undefined || to === undefined || from === to) continue
    if (to === moduleKey && !callers.includes(from)) callers.push(from)
    if (from === moduleKey && !callees.includes(to)) callees.push(to)
  }
  return { callers, callees: callees.filter((key) => !callers.includes(key)) }
}

export function insideLayout(
  files: readonly MapFileView[],
  neighbours: { readonly callers: readonly string[]; readonly callees: readonly string[] }
): InsideLayout {
  const byDepth = new Map<number, MapFileView[]>()
  for (const file of files) byDepth.set(file.depth, [...(byDepth.get(file.depth) ?? []), file])
  const columns: MapFileView[][] = []
  for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
    const group = [...(byDepth.get(depth) ?? [])].sort((a, b) => a.title.localeCompare(b.title))
    for (let i = 0; i < group.length; i += INSIDE.rowsPerColumn) columns.push(group.slice(i, i + INSIDE.rowsPerColumn))
  }
  const rows = Math.max(1, ...columns.map((column) => column.length))
  const left = neighbours.callers.length > 0 ? INSIDE.stubWidth + INSIDE.sideGap : 0
  const right = neighbours.callees.length > 0 ? INSIDE.stubWidth + INSIDE.sideGap : 0
  const filesWidth = columns.length * INSIDE.columnWidth + Math.max(0, columns.length - 1) * INSIDE.columnGap
  const width = Math.max(INSIDE.minWidth, 2 * INSIDE.padding + left + right + filesWidth)
  const stubRows = Math.max(neighbours.callers.length, neighbours.callees.length)
  const height = Math.max(
    INSIDE.minHeight,
    INSIDE.top +
      Math.max(rows * INSIDE.rowHeight - (INSIDE.rowHeight - INSIDE.fileHeight), stubRows * INSIDE.stubGap) +
      INSIDE.padding
  )
  const placed = new Map<string, Rect>()
  const x0 = INSIDE.padding + left + (width - 2 * INSIDE.padding - left - right - filesWidth) / 2
  columns.forEach((column, index) => {
    // Une colonne plus courte se centre : les appels restent lisibles.
    const y0 = INSIDE.top + ((rows - column.length) * INSIDE.rowHeight) / 2
    column.forEach((file, row) => {
      placed.set(file.key, {
        x: x0 + index * (INSIDE.columnWidth + INSIDE.columnGap),
        y: y0 + row * INSIDE.rowHeight,
        width: INSIDE.columnWidth,
        height: INSIDE.fileHeight
      })
    })
  })
  const stub = (moduleKey: string, side: 'in' | 'out', index: number): InsideStub => ({
    moduleKey,
    side,
    rect: {
      x: side === 'in' ? INSIDE.padding : width - INSIDE.padding - INSIDE.stubWidth,
      y: INSIDE.top + index * INSIDE.stubGap,
      width: INSIDE.stubWidth,
      height: INSIDE.stubHeight
    }
  })
  return {
    width,
    height,
    files: placed,
    stubs: [
      ...neighbours.callers.map((key, index) => stub(key, 'in', index)),
      ...neighbours.callees.map((key, index) => stub(key, 'out', index))
    ]
  }
}
