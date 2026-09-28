import { createHash } from 'node:crypto'

/**
 * Rapprochement local des idées écloses (spec 002 US4, research R7 amendée) : un petit graphe de mots-clés
 * partagés, calculé sans IA, choisit les candidats envoyés à Claude — peu de tokens, et aucun appel s'il n'y
 * a rien de proche.
 */

/** Au plus 10 candidats envoyés à l'IA, désignés par alias N1…N10. */
export const MAX_CANDIDATES = 10
/** Longueur d'une fiche envoyée (≈ 80 tokens) ; la fiche de l'idée qui éclôt a droit au double. */
export const CANDIDATE_CHARS = 300
export const TARGET_CHARS = 600

/** Fiche compacte d'une idée éclose : titre + points clés de son plan ou de sa synthèse. */
export interface Fiche {
  readonly id: string
  readonly title: string
  readonly categoryId: string | null
  readonly text: string
}

export interface RankedCandidate {
  readonly fiche: Fiche
  readonly alias: string
  readonly score: number
}

const STOPWORDS = new Set(
  (
    'avec pour dans sans sous chez vers entre depuis pendant avant apres alors aussi ainsi donc mais comme ' +
    'plus moins tres trop bien faire etre avoir cette celui celle ceux elles nous vous leur leurs mes tes ses ' +
    'notre votre quoi quel quelle quels quelles dont tout tous toute toutes autre autres meme encore deja ' +
    'idee etape oui non peut peux faut doit sont sera serait avoir fait faite chaque quand comment pourquoi'
  ).split(' ')
)

/** Mots significatifs : minuscules, sans accents, 4 lettres ou plus, hors mots courants. */
export function keywords(text: string): Set<string> {
  const words = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
  return new Set(words.filter((word) => word.length >= 4 && !STOPWORDS.has(word)))
}

/** Score de proximité : mots-clés partagés (normalisés par la taille de la plus petite fiche) + même catégorie. */
function proximity(a: ReadonlySet<string>, b: ReadonlySet<string>, sameCategory: boolean): number {
  let shared = 0
  for (const word of a) if (b.has(word)) shared++
  const overlap = shared === 0 ? 0 : shared / Math.min(a.size, b.size)
  return overlap + (sameCategory ? 0.5 : 0)
}

/** Candidats proches (score > 0), les plus proches d'abord, au plus 10, alias N1…N10 dans cet ordre. */
export function rankCandidates(target: Fiche, others: readonly Fiche[]): RankedCandidate[] {
  const targetWords = keywords(target.text)
  return others
    .filter((fiche) => fiche.id !== target.id)
    .map((fiche) => ({
      fiche,
      score: proximity(
        targetWords,
        keywords(fiche.text),
        target.categoryId !== null && fiche.categoryId === target.categoryId
      )
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES)
    .map((entry, index) => ({ ...entry, alias: `N${index + 1}` }))
}

/** Paire ordonnée (a < b) : un lien n'existe qu'une fois, quel que soit le sens. */
export function orderedPair(first: string, second: string): readonly [string, string] {
  return first < second ? [first, second] : [second, first]
}

export function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Empreinte d'un lien (paire + libellé normalisé) : un lien refusé n'est jamais reproposé. */
export function linkFingerprint(first: string, second: string, label: string): string {
  const [a, b] = orderedPair(first, second)
  return createHash('sha256')
    .update(`${a}|${b}|${normalizeLabel(label)}`)
    .digest('hex')
}
