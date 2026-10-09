import type { ProbeFamily, ProbeScreen, ProbeSubjectKind, ProbeVia } from '@shared/analyste/events'
import type { ProposalCategory, ProposalRisk } from '@shared/analyste/proposals'
import type { AnalysisStep, AnalysteInactiveReason, ProposalStatus, ProposalTab } from '@shared/ipc/analyste'

/** Libellés lisibles de la sonde (spec 019 FR-010) : ce que mentalyas voit à la place des noms techniques. */

export const FAMILY_LABELS: Readonly<Record<ProbeFamily, string>> = {
  navigation: 'Navigation',
  action: 'Action',
  erreur: 'Erreur',
  performance: 'Performance'
}

export const EVENT_LABELS: Readonly<Record<string, string>> = {
  'screen.open': 'Écran ouvert',
  'panel.close': 'Écran fermé',
  'neuron.create': 'Idée créée',
  'neuron.remove': 'Idée supprimée',
  'link.create': 'Lien créé',
  'block.create': 'Bloc posé',
  'history.undo': 'Annulation',
  'chat.send': 'Message envoyé',
  'plan.decide': 'Plan décidé',
  'error.renderer': 'Erreur de l’interface',
  'error.main': 'Erreur du processus principal',
  'ipc.call': 'Échange interne'
}

export const SCREEN_LABELS: Readonly<Record<ProbeScreen, string>> = {
  carte: 'carte',
  a_valider: 'À valider',
  historique: 'historique',
  reglages: 'réglages',
  chat: 'conversation',
  explorateur: 'explorateur',
  analyste: 'Analyste',
  skills: 'Skills',
  accueil: 'Project Manager'
}

export const SUBJECT_LABELS: Readonly<Record<ProbeSubjectKind, string>> = {
  neuron: 'idée',
  link: 'lien',
  block: 'bloc',
  conversation: 'conversation',
  step: 'étape',
  batch: 'lot d’historique'
}

export const VIA_LABELS: Readonly<Record<ProbeVia, string>> = {
  souris: 'souris',
  clavier: 'clavier',
  menu: 'menu',
  mcp: 'Claude (MCP)'
}

export const REASON_LABELS: Readonly<Record<AnalysteInactiveReason, string>> = {
  PACKAGED_APP:
    'L’Analyste n’existe que quand l’app tourne depuis son dépôt source (npm run dev). Dans l’app installée, rien n’est collecté.',
  NOT_DESIGNATED: 'Aucun dépôt désigné : la sonde est arrêtée.',
  REPO_MOVED: 'Le dépôt désigné a changé de place : la sonde est en pause jusqu’à ce qu’il revienne ou soit redésigné.',
  NOT_A_REPO: 'Le dossier désigné n’est plus un dépôt git du Brainstormer : la sonde est en pause.'
}

/** Catégorie d'une proposition : icône (décorative) + libellé, jamais la couleur seule. */
export const CATEGORY_LABELS: Readonly<Record<ProposalCategory, { readonly icon: string; readonly label: string }>> = {
  bug: { icon: '🐞', label: 'Bug' },
  ia_vers_code: { icon: '⚙', label: 'Tâche IA → code' },
  parcours: { icon: '🧭', label: 'Parcours' },
  code_mort: { icon: '🧹', label: 'Code mort / redondance' },
  evolutivite: { icon: '📈', label: 'Évolutivité' }
}

/** Gravité 1 à 4 (4 = critique). */
export const SEVERITY_LABELS: Readonly<Record<number, { readonly icon: string; readonly label: string }>> = {
  4: { icon: '‼', label: 'Critique' },
  3: { icon: '!', label: 'Élevée' },
  2: { icon: '•', label: 'Moyenne' },
  1: { icon: '·', label: 'Faible' }
}

export const RISK_LABELS: Readonly<Record<ProposalRisk, string>> = {
  faible: 'faible',
  moyen: 'moyen',
  eleve: 'élevé'
}

export const STEP_LABELS: Readonly<Record<Exclude<AnalysisStep, 'fini' | 'echec'>, string>> = {
  dossier: 'Préparation du dossier d’analyse…',
  claude: 'Claude lit le dépôt et analyse (cela peut prendre plusieurs minutes)…',
  controle: 'Contrôle des propositions…'
}

/** Pourquoi une analyse n'a pas abouti (codes du main et de la passerelle IA). */
export const ANALYSIS_ERROR_LABELS: Readonly<Record<string, string>> = {
  ANALYSIS_RUNNING: 'Une analyse est déjà en cours.',
  UPDATE_CODING: 'Une mise à jour est en cours de codage : l’analyse attendra sa fin.',
  PROBE_INACTIVE: 'La sonde est inactive : désigne le dépôt dans Réglages › Analyste.',
  PACKAGED_APP: 'L’Analyste n’existe pas dans l’app installée.',
  AI_UNAVAILABLE:
    'Claude Code est indisponible ou n’a pas pu répondre. Tu peux relancer : la même période sera réanalysée.',
  AUTH_FAILED: 'Claude Code n’est pas connecté : lance « claude » dans un terminal pour te connecter, puis relance.',
  AI_INVALID_OUTPUT: 'La réponse de Claude ne respectait pas le format attendu : rien n’a été gardé. Tu peux relancer.',
  AI_REFUSAL: 'Claude a refusé de traiter cette analyse.',
  CANCELLED: 'Analyse annulée : la même période sera réanalysée la prochaine fois.',
  INTERRUPTED: 'L’analyse a été interrompue (app fermée) : tu peux la relancer.',
  ANALYSIS_FAILED: 'L’analyse a échoué : tu peux la relancer.'
}

export function analysisErrorLabel(code: string | null | undefined): string {
  return ANALYSIS_ERROR_LABELS[code ?? ''] ?? `L’analyse a échoué (${code ?? 'cause inconnue'}).`
}

/** Statut d'une proposition (spec 019 FR-024a) : icône + libellé, jamais la couleur seule. */
export const STATUS_LABELS: Readonly<Record<ProposalStatus, { readonly icon: string; readonly label: string }>> = {
  new: { icon: '●', label: 'À trier' },
  postponed: { icon: '⏸', label: 'Reportée' },
  accepted: { icon: '✓', label: 'Acceptée — en attente d’application' },
  coding: { icon: '⚙', label: 'En codage' },
  to_fix: { icon: '!', label: 'À corriger' },
  ready: { icon: '▶', label: 'Prête à essayer' },
  kept: { icon: '✔', label: 'Installée' },
  applied: { icon: '✔', label: 'Installée (hors app)' },
  refused: { icon: '✕', label: 'Refusée' },
  discarded: { icon: '–', label: 'Jetée' },
  reverted: { icon: '↺', label: 'Annulée' }
}

export const TAB_LABELS: Readonly<Record<ProposalTab, string>> = {
  todo: 'À trier',
  progress: 'En cours',
  kept: 'Installées',
  dismissed: 'Écartées'
}

/** Raisons de refus prêtes (FR-024) ; un refus sans raison reste possible. */
export const REFUSAL_REASONS: readonly string[] = ['Pas utile', 'Déjà prévu', 'Trop risqué', 'Constat inexact']
