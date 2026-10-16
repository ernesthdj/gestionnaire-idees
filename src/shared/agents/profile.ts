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
}

export type AgentProfileInput = Omit<AgentProfileView, 'id' | 'updatedAt'> & { readonly id?: string }
