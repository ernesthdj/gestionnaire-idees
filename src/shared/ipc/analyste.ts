import type { ProbeFamily, ProbeScreen, ProbeStatus, ProbeSubjectKind, ProbeVia } from '../analyste/events'
import type { ProposalCategory, ProposalRisk } from '../analyste/proposals'

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
  maxEvents: { min: 10_000, max: 200_000, default: 50_000 },
  /** Propositions gardées au plus par analyse (FR-017). */
  maxProposals: { min: 1, max: 10, default: 5 },
  /** Répétitions d'une même entrée d'IA pour un fait « IA → code » (FR-019). */
  repeatThreshold: { min: 2, max: 50, default: 5 },
  /** Observations nouvelles en dessous desquelles l'analyse demande confirmation (FR-012, FR-040). */
  minEvents: { min: 10, max: 10_000, default: 200 }
} as const

export interface AnalysteSettingsView {
  readonly retentionDays: number
  readonly maxEvents: number
  readonly maxProposals: number
  readonly repeatThreshold: number
  readonly minEvents: number
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

/** Analyse (spec 019 data-model `analyses`) : déclencheur, période, statut ; jamais de contenu. */
export const ANALYSIS_STATUSES = ['running', 'done', 'failed', 'cancelled'] as const
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number]

export interface AnalysisView {
  readonly id: string
  readonly trigger: 'manual' | 'auto'
  readonly status: AnalysisStatus
  readonly windowFrom: number
  readonly windowTo: number
  readonly events: number
  readonly proposals: number
  readonly errorCode: string | null
  readonly startedAt: number
  readonly finishedAt: number | null
}

export const ANALYSES_LIMIT = 20

/** Étapes annoncées pendant une analyse (événement `analyste:progress`). */
export const ANALYSIS_STEPS = ['dossier', 'claude', 'controle', 'fini', 'echec'] as const
export type AnalysisStep = (typeof ANALYSIS_STEPS)[number]

export interface AnalysisProgressEvent {
  readonly analysisId: string
  readonly step: AnalysisStep
  /** Propositions gardées (étape `fini`). */
  readonly proposals?: number
  /** Cause d'un échec (étape `echec`) : `AI_UNAVAILABLE`, `AUTH_FAILED`, `AI_INVALID_OUTPUT`, `CANCELLED`… */
  readonly errorCode?: string
}

export const PROPOSAL_STATUSES = [
  'new',
  'postponed',
  'refused',
  'accepted',
  'coding',
  'to_fix',
  'ready',
  'kept',
  'discarded',
  'reverted',
  // Appliquée par mentalyas hors de l'app (spec 019 D10).
  'applied'
] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

/** Décisions de tri (FR-024, D10). */
export const PROPOSAL_DECISIONS = ['accept', 'refuse', 'postpone', 'resume', 'applied'] as const
export type ProposalDecision = (typeof PROPOSAL_DECISIONS)[number]

/** Propositions closes, retirées par « Vider l'historique » (D11). */
export const CLOSED_STATUSES: readonly ProposalStatus[] = ['kept', 'applied', 'refused', 'discarded', 'reverted']

/** Onglets de la boîte (spec 019 FR-022) et statuts qu'ils regroupent. */
export const PROPOSAL_TAB_NAMES = ['todo', 'progress', 'kept', 'dismissed'] as const
export type ProposalTab = (typeof PROPOSAL_TAB_NAMES)[number]
export const PROPOSAL_TABS: Readonly<Record<ProposalTab, readonly ProposalStatus[]>> = {
  todo: ['new'],
  progress: ['postponed', 'accepted', 'coding', 'to_fix', 'ready'],
  kept: ['kept', 'applied'],
  dismissed: ['refused', 'discarded', 'reverted']
}

export const PROPOSALS_PAGE_LIMIT = 50

/** Fiche d'une proposition : texte écrit par Claude sur le code de l'app, affiché comme texte (FR-026). */
export interface ProposalView {
  readonly id: string
  readonly analysisId: string
  readonly category: ProposalCategory
  readonly title: string
  readonly finding: string
  readonly proposal: string
  readonly gain: string
  readonly risk: ProposalRisk
  readonly severity: number
  readonly confidence: number
  readonly evidence: {
    /** Preuves d'observation en phrases lisibles, avec leur clé (`obs:err:1`). */
    readonly observations: readonly { readonly key: string; readonly sentence: string }[]
    readonly code: readonly { readonly path: string; readonly start?: number; readonly end?: number }[]
  }
  readonly files: readonly string[]
  /** Évolutivité sans preuve : « idée, sans preuve d'usage ». */
  readonly withoutEvidence: boolean
  readonly status: ProposalStatus
  readonly refusalReason: string | null
  readonly createdAt: number
}

/** États d'une mise à jour de l'Analyste (spec 019 US4, data-model `analyst_updates`). */
export const UPDATE_STATUSES = [
  'coding',
  'to_fix',
  'ready',
  'keeping',
  'kept',
  'discarded',
  'reverted',
  'failed'
] as const
export type UpdateStatus = (typeof UPDATE_STATUSES)[number]

export const UPDATE_CHECKS = ['typecheck', 'lint', 'prettier', 'test'] as const
export type UpdateCheckName = (typeof UPDATE_CHECKS)[number]
export type UpdateCheckStatus = 'pending' | 'running' | 'ok' | 'fail'

/** Mise à jour d'une proposition : branche `analyste/*`, copie de travail, vérifications, conversation de codage. */
export interface UpdateView {
  readonly id: string
  readonly proposalId: string
  readonly branch: string
  /** Dossier de la copie de travail (affiché pour « Essayer » et les dépendances). */
  readonly folder: string
  readonly status: UpdateStatus
  readonly checks: Readonly<Record<UpdateCheckName, { readonly status: UpdateCheckStatus; readonly tail?: string }>>
  /** `package.json` / `package-lock.json` touchés : dépendances à installer à la main dans la copie (D12). */
  readonly depsChanged: boolean
  readonly conversationNeuronId: string | null
  readonly createdAt: number
}

export interface UpdateProgressEvent {
  readonly updateId: string
  readonly step: 'commit' | 'checks' | 'ready' | 'to_fix' | 'keeping' | 'kept' | 'discarded' | 'failed'
  readonly check?: { readonly name: UpdateCheckName; readonly status: UpdateCheckStatus }
}

export interface UpdateDiffView {
  readonly files: readonly { readonly path: string; readonly added: number; readonly removed: number }[]
  readonly patch: string
  readonly truncated: boolean
}
