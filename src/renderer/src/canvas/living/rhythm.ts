/**
 * Rythme de flottaison d'un nœud (spec 022 D3) : durée, décalage, amplitudes et rotation déduits de son identifiant,
 * donc différents d'un nœud à l'autre et identiques d'une ouverture à l'autre. Fonctions pures.
 */

export interface Rhythm {
  /** Durée d'une oscillation (secondes). */
  readonly dur: number
  /** Décalage de départ (secondes, négatif : l'animation est déjà en cours). */
  readonly delay: number
  /** Amplitudes horizontale et verticale (pixels). */
  readonly ax: number
  readonly ay: number
  /** Rotation maximale (degrés). */
  readonly rot: number
}

/** Empreinte FNV-1a d'un texte, ramenée dans [0, 1]. */
export function hash(text: string): number {
  let h = 2166136261
  for (const char of text) h = Math.imul(h ^ (char.codePointAt(0) ?? 0), 16777619)
  return (h >>> 0) / 4294967295
}

const round = (value: number, digits: number): number => Number(value.toFixed(digits))

export function rhythm(id: string): Rhythm {
  const a = hash(id)
  const b = hash(`${id}b`)
  const c = hash(`${id}c`)
  return {
    dur: round(5 + a * 4, 2),
    delay: round(-a * 9, 2),
    ax: round(2 + b * 4, 1),
    ay: round(3 + c * 5, 1),
    rot: round((b - 0.5) * 2.4, 2)
  }
}

/** Variables CSS de la couche flottante (`canvas.css`, animations `drift` et `depth`). */
export function rhythmStyle(id: string): Record<string, string> {
  const r = rhythm(id)
  return {
    '--float-dur': `${r.dur}s`,
    '--float-delay': `${r.delay}s`,
    '--float-ax': `${r.ax}px`,
    '--float-ay': `${r.ay}px`,
    '--float-rot': `${r.rot}deg`
  }
}
