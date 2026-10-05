/**
 * Libellé de rang d'une étape (spec 011) : ① pour une étape du genesis, ②.1 pour la première sous-étape de ②.
 * `ranks` : rangs du chemin, de l'étape de niveau 1 à l'étape elle-même.
 */
export function rankLabel(ranks: readonly number[]): string {
  const [first, ...rest] = ranks
  if (first === undefined) return ''
  // ① … ⑳ existent en Unicode ; au-delà, le chiffre simple.
  const head = first >= 1 && first <= 20 ? String.fromCodePoint(0x2460 + first - 1) : String(first)
  return [head, ...rest.map(String)].join('.')
}
