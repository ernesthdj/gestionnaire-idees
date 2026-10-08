/**
 * Chemins des éléments d'une carte de structure (spec 017 US7) : quel élément couvre un fichier du projet. Fonctions
 * pures, partagées par le main (appels mesurés, fichiers d'un élément) et l'interface (pont Workflow → structure,
 * spec 023 US4).
 */

/** Chemin d'élément normalisé : séparateurs `/`, sans `./` de tête ni `/` final. */
export const normalizeElementPath = (path: string): string =>
  path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')

/** Le fichier est-il désigné par un chemin d'élément (lui-même, ou un dossier qui le contient) ? */
export const covers = (paths: readonly string[], file: string): boolean =>
  paths.some((path) => path !== '' && (file === path || file.startsWith(`${path}/`)))

export interface CoveringCandidate {
  readonly id: string
  /** Profondeur dans l'arbre de la carte (0 = module). */
  readonly depth: number
  /** Chemins déjà normalisés. */
  readonly paths: readonly string[]
}

/**
 * Élément qui couvre un fichier : le plus profond, puis, à profondeur égale, celui dont le chemin est le plus précis ;
 * `null` si aucun ne le couvre.
 */
export function coveringElement(candidates: readonly CoveringCandidate[], file: string): string | null {
  let best: { id: string; depth: number; length: number } | null = null
  for (const candidate of candidates) {
    const length = Math.max(-1, ...candidate.paths.filter((path) => covers([path], file)).map((path) => path.length))
    if (length < 0) continue
    if (best === null || candidate.depth > best.depth || (candidate.depth === best.depth && length > best.length)) {
      best = { id: candidate.id, depth: candidate.depth, length }
    }
  }
  return best?.id ?? null
}
