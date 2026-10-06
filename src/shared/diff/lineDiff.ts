/**
 * Différence ligne à ligne entre deux textes (spec 013 R6) : algorithme de Myers (O(ND)), sans dépendance. Au-delà
 * de la borne de lignes différentes, la différence n'est pas détaillée : seul un résumé est rendu.
 */

export type DiffLine =
  | { readonly kind: 'same'; readonly text: string }
  | { readonly kind: 'added'; readonly text: string }
  | { readonly kind: 'removed'; readonly text: string }

export type LineDiff =
  | { readonly kind: 'lines'; readonly lines: readonly DiffLine[]; readonly added: number; readonly removed: number }
  | { readonly kind: 'summary'; readonly beforeLines: number; readonly afterLines: number }

/** Nombre maximal de lignes différentes avant de renoncer au détail. */
export const DIFF_MAX_CHANGES = 5000

const splitLines = (text: string): string[] => (text === '' ? [] : text.replace(/\r\n/g, '\n').split('\n'))

/** Diagonale précédente sur le chemin le plus court (règle de Myers). */
const goesDown = (v: Int32Array, offset: number, k: number, d: number): boolean =>
  k === -d || (k !== d && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0))

/** `before` absent (`null`) = fichier créé : toutes ses lignes sont ajoutées. */
export function lineDiff(before: string | null, after: string, maxChanges = DIFF_MAX_CHANGES): LineDiff {
  const a = splitLines(before ?? '')
  const b = splitLines(after)
  const n = a.length
  const m = b.length
  const offset = n + m + 1
  const v = new Int32Array(2 * offset + 1)
  const trace: Int32Array[] = []
  let found = false
  for (let d = 0; d <= Math.min(n + m, maxChanges) && !found; d += 1) {
    trace.push(v.slice())
    for (let k = -d; k <= d; k += 2) {
      let x = goesDown(v, offset, k, d) ? (v[offset + k + 1] ?? 0) : (v[offset + k - 1] ?? 0) + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x += 1
        y += 1
      }
      v[offset + k] = x
      if (x >= n && y >= m) {
        found = true
        break
      }
    }
  }
  if (!found) return { kind: 'summary', beforeLines: n, afterLines: m }

  // Remontée : du bout vers le début, à travers les états mémorisés avant chaque passe.
  const lines: DiffLine[] = []
  let x = n
  let y = m
  for (let d = trace.length - 1; d >= 0; d -= 1) {
    const state = trace[d] as Int32Array
    const k = x - y
    const previousK = goesDown(state, offset, k, d) ? k + 1 : k - 1
    const previousX = d === 0 ? 0 : (state[offset + previousK] ?? 0)
    const previousY = d === 0 ? 0 : previousX - previousK
    while (x > previousX && y > previousY) {
      x -= 1
      y -= 1
      lines.push({ kind: 'same', text: a[x] ?? '' })
    }
    if (d > 0) {
      if (x === previousX) lines.push({ kind: 'added', text: b[previousY] ?? '' })
      else lines.push({ kind: 'removed', text: a[previousX] ?? '' })
    }
    x = previousX
    y = previousY
  }
  lines.reverse()
  let added = 0
  let removed = 0
  for (const line of lines) {
    if (line.kind === 'added') added += 1
    else if (line.kind === 'removed') removed += 1
  }
  return { kind: 'lines', lines, added, removed }
}
