/** Hasard reproductible et raretés des personnages d'agents (T008, L1o D13). */

/** Générateur pseudo-aléatoire (mulberry32) : la même graine donne toujours la même suite. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Graine stable tirée d'un texte (FNV-1a 32 bits) : l'identifiant d'un profil donne toujours le même personnage. */
export function seedOf(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export const TIERS = ['commun', 'peu', 'rare', 'epique', 'legend'] as const
export type Tier = (typeof TIERS)[number]

export const TIER_LABELS: Readonly<Record<Tier, string>> = {
  commun: 'Commun',
  peu: 'Peu commun',
  rare: 'Rare',
  epique: 'Épique',
  legend: 'Légendaire'
}

export const tierRank = (tier: Tier): number => TIERS.indexOf(tier)

/** Le plus rare de deux paliers. */
export const rarer = (a: Tier, b: Tier): Tier => (tierRank(b) > tierRank(a) ? b : a)

export interface Weighted {
  readonly tier: Tier
  /** Poids du tirage : plus il est grand, plus la variante sort souvent. */
  readonly w: number
}

/** Tire une variante selon les poids. */
export function pick<T extends Weighted>(r: () => number, list: readonly T[]): T {
  const total = list.reduce((sum, v) => sum + v.w, 0)
  let x = r() * total
  for (const v of list) {
    x -= v.w
    if (x < 0) return v
  }
  return list[0] as T
}
