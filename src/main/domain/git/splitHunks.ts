import { createHash } from 'node:crypto'
import { lineDiff } from '@shared/diff/lineDiff'

/**
 * Fusion à trois voies faite par l'app (spec 021 US4, L3 conflits §2) : à partir de la base commune, de « ta version »
 * (`:2:`) et de « leur version » (`:3:`) lues dans l'index de git, ce qui n'a changé que d'un côté est pris d'office
 * (comme git) ; seules les divergences des deux côtés deviennent des blocs à décider. L'aperçu assemble les parties
 * communes et les décisions ; un bloc non décidé garde ses marqueurs (aperçu honnête). Pur.
 */

export type HunkChoice = 'ours' | 'theirs' | 'both' | 'claude' | 'manual'

export type Segment =
  | { readonly kind: 'stable'; readonly lines: readonly string[] }
  | {
      readonly kind: 'conflict'
      readonly index: number
      readonly base: readonly string[]
      readonly ours: readonly string[]
      readonly theirs: readonly string[]
    }

export interface HunkDecision {
  readonly choice: HunkChoice
  /** Texte d'une proposition de Claude (`claude`) ou d'une édition (`manual`). */
  readonly text?: string
}

const split = (text: string): string[] => (text === '' ? [] : text.replace(/\r\n/g, '\n').split('\n'))
const same = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((line, index) => line === b[index])

/** Pour chaque ligne de `base`, l'index de la ligne identique appariée dans `other` (-1 : modifiée ou supprimée). */
function matches(base: readonly string[], other: readonly string[]): number[] | null {
  const diff = lineDiff(base.join('\n'), other.join('\n'))
  if (diff.kind !== 'lines') return null
  const result = new Array<number>(base.length).fill(-1)
  let b = 0
  let o = 0
  for (const line of diff.lines) {
    if (line.kind === 'same') {
      result[b] = o
      b += 1
      o += 1
    } else if (line.kind === 'removed') b += 1
    else o += 1
  }
  return result
}

/** Découpe en parties stables et blocs en conflit ; `null` pour la base d'un ajout des deux côtés. */
export function splitHunks(baseText: string | null, oursText: string, theirsText: string): Segment[] {
  const base = split(baseText ?? '')
  const ours = split(oursText)
  const theirs = split(theirsText)
  const toOurs = matches(base, ours)
  const toTheirs = matches(base, theirs)
  // Fichier trop différent pour le détail : un seul bloc.
  if (toOurs === null || toTheirs === null) {
    return same(ours, theirs) ? [{ kind: 'stable', lines: ours }] : [{ kind: 'conflict', index: 0, base, ours, theirs }]
  }
  const segments: Segment[] = []
  let stable: string[] = []
  const flush = (): void => {
    if (stable.length > 0) segments.push({ kind: 'stable', lines: stable })
    stable = []
  }
  let conflicts = 0
  let b = 0
  let o = 0
  let t = 0
  while (b < base.length || o < ours.length || t < theirs.length) {
    // Région stable : la même ligne de base, intacte des deux côtés.
    while (b < base.length && toOurs[b] === o && toTheirs[b] === t) {
      stable.push(ours[o] ?? '')
      b += 1
      o += 1
      t += 1
    }
    if (b >= base.length && o >= ours.length && t >= theirs.length) break
    // Prochain point de synchronisation : une ligne de base intacte des deux côtés.
    let next = b
    while (next < base.length && ((toOurs[next] ?? -1) < o || (toTheirs[next] ?? -1) < t)) next += 1
    const oursEnd = next < base.length ? (toOurs[next] ?? ours.length) : ours.length
    const theirsEnd = next < base.length ? (toTheirs[next] ?? theirs.length) : theirs.length
    const baseChunk = base.slice(b, next)
    const oursChunk = ours.slice(o, oursEnd)
    const theirsChunk = theirs.slice(t, theirsEnd)
    if (same(oursChunk, baseChunk)) stable.push(...theirsChunk)
    else if (same(theirsChunk, baseChunk) || same(oursChunk, theirsChunk)) stable.push(...oursChunk)
    else {
      flush()
      segments.push({ kind: 'conflict', index: conflicts, base: baseChunk, ours: oursChunk, theirs: theirsChunk })
      conflicts += 1
    }
    b = next
    o = oursEnd
    t = theirsEnd
  }
  flush()
  return segments
}

const MARKERS = { start: '<<<<<<< ta version', middle: '=======', end: '>>>>>>> leur version' } as const

/** Lignes d'un bloc selon la décision ; sans décision : les marqueurs, comme dans le fichier de git. */
function hunkLines(segment: Extract<Segment, { kind: 'conflict' }>, decision: HunkDecision | undefined): string[] {
  switch (decision?.choice) {
    case 'ours':
      return [...segment.ours]
    case 'theirs':
      return [...segment.theirs]
    case 'both':
      return [...segment.ours, ...segment.theirs]
    case 'claude':
    case 'manual':
      return split(decision.text ?? '')
    default:
      return [MARKERS.start, ...segment.ours, MARKERS.middle, ...segment.theirs, MARKERS.end]
  }
}

/** Aperçu du fichier selon les décisions ; fins de ligne de « ta version » conservées. */
export function assemble(
  segments: readonly Segment[],
  decisions: ReadonlyMap<number, HunkDecision>,
  eol: '\n' | '\r\n' = '\n'
): string {
  return segments
    .flatMap((segment) =>
      segment.kind === 'stable' ? segment.lines : hunkLines(segment, decisions.get(segment.index))
    )
    .join(eol)
}

/** Un texte contient-il encore un marqueur de conflit (début de ligne) ? */
export function hasMarkers(text: string): boolean {
  return /^(<{7}|={7}|>{7})(\s|$)/m.test(text)
}

export const previewHash = (preview: string): string => createHash('sha256').update(preview).digest('hex').slice(0, 32)

/** Fin de ligne d'un texte : celle de « ta version ». */
export const eolOf = (text: string): '\n' | '\r\n' => (text.includes('\r\n') ? '\r\n' : '\n')

/** Lignes d'une proposition absentes des deux versions (surlignées pour mentalyas, L3 §7). */
export function newLines(proposal: string, ours: readonly string[], theirs: readonly string[]): number[] {
  const known = new Set([...ours, ...theirs].map((line) => line.trim()))
  return split(proposal).flatMap((line, index) => (line.trim() !== '' && !known.has(line.trim()) ? [index] : []))
}
