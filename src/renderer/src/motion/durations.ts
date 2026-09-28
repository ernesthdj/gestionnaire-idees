import type { MotionMode } from '@shared/ipc/app'

/** Durées des animations (FR-025), en millisecondes. */
export const DURATIONS = {
  grow: 250,
  dive: 400,
  fusion: 700,
  migrate: 600,
  suggestion: 150,
  /** Pulsation du halo des neurones éclos (une période). */
  halo: 2400
} as const

export type AnimationKind = keyof typeof DURATIONS

/** Fondu maximal autorisé quand les animations sont réduites (SC-006). */
export const REDUCED_FADE_MS = 150

/** Animations réduites si le réglage de l'app le demande OU si le système le demande (mode `auto`). */
export function isReducedMotion(mode: MotionMode, systemPrefersReduced: boolean): boolean {
  return mode === 'reduced' || systemPrefersReduced
}

export interface MotionTiming {
  /** Durée en millisecondes. */
  readonly duration: number
  /** `false` : aucun déplacement, aucune mise à l'échelle — seulement un fondu (ou rien). */
  readonly movement: boolean
  readonly repeat: boolean
}

/**
 * Paramètres d'une animation : durée normale, ou en mode réduit un fondu court sans mouvement
 * (0 ms pour ce qui n'est que du mouvement : dérive, halo, plongée).
 */
export function timingFor(kind: AnimationKind, reduced: boolean): MotionTiming {
  if (!reduced) return { duration: DURATIONS[kind], movement: true, repeat: kind === 'halo' }
  const fadeOnly = kind === 'grow' || kind === 'fusion' || kind === 'migrate' || kind === 'suggestion'
  return { duration: fadeOnly ? Math.min(DURATIONS[kind], REDUCED_FADE_MS) : 0, movement: false, repeat: false }
}
