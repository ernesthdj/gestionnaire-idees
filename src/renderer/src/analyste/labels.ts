import type { ProbeFamily, ProbeScreen, ProbeSubjectKind, ProbeVia } from '@shared/analyste/events'
import type { AnalysteInactiveReason } from '@shared/ipc/analyste'

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
  analyste: 'Analyste'
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
