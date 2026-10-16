import type { PassIndex } from './pipeline'
import type { AgentRole } from './profile'
import type { SpecAgents } from './recommendation'

/** Documents d'un pipeline d'agents (docs/TACHES-AGENTS.md T002) : spec du PO, rapports, journaux. */

export const PIPELINE_DIR = 'docs/pipeline'
export const PROJECT_JOURNAL_FILE = `${PIPELINE_DIR}/JOURNAL.md`
export const GLOBAL_JOURNAL_FILE = 'pipeline-journal.md'

/** Seul ce rôle écrit (et modifie) la spec signée d'une tâche. */
export const SPEC_OWNER_ROLE: AgentRole = 'po'

/** Journal global court : au-delà de MAX, les entrées anciennes sont condensées (une ligne par tâche). */
export const GLOBAL_JOURNAL_MAX_ENTRIES = 60
export const GLOBAL_JOURNAL_KEEP_ENTRIES = 25
export const GLOBAL_JOURNAL_MAX_CONDENSED = 30
export const JOURNAL_MESSAGE_MAX = 300
export const DOCUMENT_MAX_BYTES = 200_000

const TASK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
export const isValidTaskId = (id: string): boolean => TASK_ID.test(id)

export interface PipelineSpec {
  readonly taskId: string
  readonly signedBy: AgentRole
  /** 1 à la première signature ; chaque réécriture du PO la monte d'un cran (L1o D9). */
  readonly version: number
  readonly signedAt: number
  readonly content: string
  /** Agents recommandés ou à créer, lus dans la spec (T009, L1o D1) : des propositions, mentalyas décide. */
  readonly agents: SpecAgents
}

export interface PipelineReport {
  readonly taskId: string
  /** Agent de l'assemblage qui l'a rendu (deux agents peuvent avoir le même rôle). */
  readonly agentId: string
  readonly role: AgentRole
  /** Passe de l'agent qui l'a rendu (numéro, nature, version de spec appliquée). */
  readonly index: PassIndex
  readonly writtenAt: number
  readonly content: string
}

export interface JournalEntry {
  readonly at: number
  readonly project: string
  readonly taskId: string
  readonly role: AgentRole
  readonly message: string
}
