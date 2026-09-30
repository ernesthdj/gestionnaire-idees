/**
 * Garde-fous déterministes de la croissance (spec 002 contracts/ai-outputs.md E1–E4) :
 * l'IA propose, l'application garantit les règles.
 */

/** Minimum d'extensions exigé au premier développement d'un neurone (E1). */
export const MIN_EXTENSIONS = 3
/** Au-delà de cette profondeur, l'IA ne propose plus d'extension sur le chemin (E3). */
export const MAX_AI_DEPTH = 6
/** Nombre de réponses sous lequel la jauge reste « insuffisant » (E4). */
export const GAUGE_FLOOR_ANSWERS = 3

/**
 * Nombre de réponses sous lequel l'IA ne propose aucune idée (décision du 2026-09-30) : avant, elle manque de
 * contexte et ses idées sont faibles.
 */
export const MIN_ANSWERS_FOR_SUGGESTIONS = 3

/** Une idée qui a déjà éclos (document) a assez de contexte, quel que soit le nombre de réponses du cycle. */
export function suggestionsAllowed(answered: number, hasDocument: boolean): boolean {
  return hasDocument || answered >= MIN_ANSWERS_FOR_SUGGESTIONS
}

export type GaugeLevel = 'insufficient' | 'sufficient' | 'complete'

interface ProposedExtension {
  readonly question: string
}

/** Forme comparable d'une question : minuscules, sans accents, ponctuation ni espaces superflus. */
export function normalizeQuestion(question: string): string {
  return question
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Retire les questions déjà posées, répondues ou écartées, et les doublons internes (E2). */
export function filterNewExtensions<T extends ProposedExtension>(
  proposed: readonly T[],
  known: readonly string[]
): T[] {
  const seen = new Set(known.map(normalizeQuestion))
  const kept: T[] = []
  for (const extension of proposed) {
    const key = normalizeQuestion(extension.question)
    if (key === '' || seen.has(key)) continue
    seen.add(key)
    kept.push(extension)
  }
  return kept
}

/** Plancher de la jauge : jamais « suffisant » avant 3 réponses, quoi qu'en dise l'IA (E4). */
export function applyGaugeFloor(aiLevel: GaugeLevel, answered: number): GaugeLevel {
  return answered < GAUGE_FLOOR_ANSWERS ? 'insufficient' : aiLevel
}

interface ProposedSuggestion {
  readonly neuronRef: string
  readonly title: string
  readonly webQuery?: string | undefined
}

/**
 * Suggestions retenues (S2) : rattachées à un neurone existant, jamais déjà faites ni identiques à un neurone,
 * et une seule vérification web par appel (coût borné) — les autres restent de simples suggestions.
 */
export function filterNewSuggestions<T extends ProposedSuggestion>(
  proposed: readonly T[],
  knownRefs: ReadonlySet<string>,
  knownTitles: readonly string[]
): (T & { readonly research: boolean })[] {
  const seen = new Set(knownTitles.map(normalizeQuestion))
  const kept: (T & { readonly research: boolean })[] = []
  for (const suggestion of proposed) {
    const key = normalizeQuestion(suggestion.title)
    if (!knownRefs.has(suggestion.neuronRef) || key === '' || seen.has(key)) continue
    seen.add(key)
    const research = suggestion.webQuery !== undefined && !kept.some((entry) => entry.research)
    kept.push({ ...suggestion, research })
  }
  return kept
}
