import { isToBrainstorm, type BrainstormDocView } from '@shared/ipc/workflow'
import { clip, WORKFLOW_LIMITS } from './limits'

const NAME = /^L(\d)([a-z]?)(?:-([a-z0-9-]+))?\.md$/i
/** Mots trop communs pour rattacher un document à une idée. */
const STOP_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'a', 'projet'])

const wordsOf = (slug: string | undefined): string[] =>
  (slug ?? '')
    .toLowerCase()
    .split('-')
    .filter((word) => word !== '' && !STOP_WORDS.has(word))

/** Niveau d'un document de brainstorm (`L2-…` → 2) ; `null` si ce n'en est pas un. */
export function brainstormLevel(name: string): number | null {
  const level = NAME.exec(name)?.[1]
  return level === undefined ? null : Number(level)
}

export interface BrainstormEntry {
  readonly name: string
  readonly text: string
}

/**
 * Documents de brainstorm (spec 023 D11) : niveau, titre (`# …`), famille d'un L2–L4 (le L1 dont un mot est le
 * premier mot du document ; à égalité, celui qui partage le plus de mots ; sinon aucune) et specs qui le citent. Pur.
 */
export function brainstormDocs(
  entries: readonly BrainstormEntry[],
  specs: readonly { readonly number: string; readonly citedDocs: readonly string[] }[]
): BrainstormDocView[] {
  const parsed = entries.flatMap((entry) => {
    const match = NAME.exec(entry.name)
    if (match === null) return []
    const heading = /^#\s+(.+)$/m.exec(entry.text)?.[1]?.trim()
    return [
      {
        name: entry.name,
        level: Number(match[1]),
        words: wordsOf(match[3]),
        title: clip(heading === undefined || heading === '' ? entry.name : heading, WORKFLOW_LIMITS.title)
      }
    ]
  })
  const firstLevel = parsed.filter((doc) => doc.level === 1 && doc.words.length > 0)
  const familyOf = (words: readonly string[]): string | null => {
    const first = words[0]
    if (first === undefined) return null
    const candidates = firstLevel.filter((doc) => doc.words.includes(first))
    const shared = (doc: { words: readonly string[] }): number =>
      doc.words.filter((word) => words.includes(word)).length
    return [...candidates].sort((a, b) => shared(b) - shared(a) || a.name.localeCompare(b.name))[0]?.name ?? null
  }
  return parsed
    .map((doc): BrainstormDocView => ({
      name: doc.name,
      level: doc.level,
      title: doc.title,
      family: doc.level === 1 ? null : familyOf(doc.words),
      coveredBy: specs.filter((spec) => spec.citedDocs.includes(doc.name)).map((spec) => spec.number)
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Idées à brainstormer : les L1 qu'aucune spec ne cite, hors fondation (D11). */
export const toBrainstorm = (docs: readonly BrainstormDocView[]): BrainstormDocView[] => docs.filter(isToBrainstorm)
