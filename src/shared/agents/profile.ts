import { PERMISSION_MODES, type PermissionMode } from '../ipc/chat'

/** Profils d'agents des pipelines (docs/TACHES-AGENTS.md T001) : qui fait quoi, avec quels droits, quel modèle, quels skills. */

export const AGENT_ROLES = ['po', 'architecte', 'backend', 'frontend', 'qa', 'autre'] as const
export type AgentRole = (typeof AGENT_ROLES)[number]

export const AGENT_ROLE_LABELS: Readonly<Record<AgentRole, string>> = {
  po: 'Product Owner',
  architecte: 'Architecte',
  backend: 'Backend',
  frontend: 'Frontend',
  qa: 'QA',
  autre: 'Autre'
}

export const AGENT_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type AgentEffort = (typeof AGENT_EFFORTS)[number]

export const AGENT_EFFORT_LABELS: Readonly<Record<AgentEffort, string>> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
  xhigh: 'Très élevé',
  max: 'Maximal'
}

export const AGENT_PERMISSION_LABELS: Readonly<Record<PermissionMode, string>> = {
  default: 'Demander avant d’écrire',
  acceptEdits: 'Écrire sans demander',
  bypassPermissions: 'Libre (tout, sans demander)'
}

export { PERMISSION_MODES }
export type { PermissionMode }

export const MAX_AGENT_SKILLS = 30

export interface AgentProfileView {
  readonly id: string
  readonly name: string
  readonly role: AgentRole
  /** Consignes propres à l'agent, ajoutées à sa mission (≤ 4000 caractères). */
  readonly instructions: string
  readonly permissionMode: PermissionMode
  readonly model: string
  readonly effort: AgentEffort
  /** Identifiants de skills (`perso:<nom>`…) que l'agent peut consulter. */
  readonly skills: readonly string[]
  readonly updatedAt: number
  /**
   * Travail livré par cet agent : un point par assemblage validé par le QA, un autre à la fusion acceptée. Enrichit sa
   * chambre sur la carte (L1o D13) ; compté par l'app, jamais saisi.
   */
  readonly delivered: number
}

export type AgentProfileInput = Omit<AgentProfileView, 'id' | 'updatedAt' | 'delivered'> & {
  readonly id?: string
  /** Création avec l'identifiant tiré à l'aperçu (L1o D21) : le personnage montré est celui qui naît. */
  readonly isNew?: true
}

/** Skills qu'un agent propose d'ajouter ou de retirer de son profil, en visio (L1o D16, événement `agents:skillsProposal`). */
export interface AgentSkillsProposal {
  /** Conversation de visio d'où vient la proposition. */
  readonly neuronId: string
  readonly profileId: string
  readonly add: readonly string[]
  readonly remove: readonly string[]
  readonly why: string
}

/** Champs de fiche proposés par Claude dans la conversation « Créer avec Claude » (L1o D15, événement `agents:proposal`). */
export interface AgentProfileProposal {
  /** Conversation d'où vient la proposition : seule la fiche ouverte à côté d'elle la reçoit. */
  readonly neuronId: string
  readonly fields: Partial<Omit<AgentProfileInput, 'id'>>
  readonly why: string | null
}
