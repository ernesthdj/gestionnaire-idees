import type { ProbeFamily, ProbeScreen, ProbeStatus, ProbeSubjectKind, ProbeVia } from '../analyste/events'

/** Vues et contrats de l'Analyste interne (spec 019 contracts/interfaces.md). Aucune vue ne porte de contenu saisi. */

/** Pourquoi l'Analyste n'est pas actif (spec 019 FR-001, research R12). */
export const ANALYSTE_INACTIVE_REASONS = ['PACKAGED_APP', 'NOT_DESIGNATED', 'REPO_MOVED', 'NOT_A_REPO'] as const
export type AnalysteInactiveReason = (typeof ANALYSTE_INACTIVE_REASONS)[number]

export interface AnalysteStatusView {
  /** Faux dans l'app installée : la section Analyste explique pourquoi elle est indisponible. */
  readonly available: boolean
  /** Sonde active : dépôt désigné et revérifié. */
  readonly active: boolean
  readonly repoPath: string | null
  readonly reason: AnalysteInactiveReason | null
  readonly observations: number
  /** Événements abandonnés ou ignorés depuis le démarrage (rafales, lots invalides). */
  readonly dropped: number
}

export const ANALYSTE_SETTINGS_LIMITS = {
  retentionDays: { min: 7, max: 90, default: 30 },
  maxEvents: { min: 10_000, max: 200_000, default: 50_000 }
} as const

export interface AnalysteSettingsView {
  readonly retentionDays: number
  readonly maxEvents: number
}

export interface ObservationView {
  readonly id: number
  readonly at: number
  readonly family: ProbeFamily
  readonly event: string
  readonly screen: ProbeScreen | null
  readonly subjectKind: ProbeSubjectKind | null
  readonly subjectRef: string | null
  readonly via: ProbeVia | null
  readonly channel: string | null
  readonly code: string | null
  readonly module: string | null
  readonly frames: readonly string[]
  readonly durationMs: number | null
  readonly status: ProbeStatus | null
  readonly count: number
}

export const OBSERVATIONS_PAGE_LIMIT = 200

export interface ObservationsPageView {
  readonly items: readonly ObservationView[]
  /** Curseur de la page suivante (identifiant), `null` à la fin. */
  readonly next: number | null
  readonly totals: Readonly<Record<ProbeFamily, number>>
}
