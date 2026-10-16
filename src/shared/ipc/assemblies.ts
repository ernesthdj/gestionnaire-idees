import type { SketchLot } from '@shared/agents/lotPlan'
import type {
  AgentProgressState,
  ApprovalResult,
  AssemblyAgent,
  AssemblyLink,
  AssemblyRunResult,
  PassNature,
  QaVerdict
} from '../agents/pipeline'

/** Assemblages d'agents connectés à un nœud (docs/TACHES-AGENTS.md T005, L1o D1 et D12). */

export type AssemblyRunState = 'running' | 'finished' | 'failed'

/** État en direct d'un agent de l'assemblage (T006) : ce que son nœud de la carte montre. */
export interface AgentLiveView {
  readonly agentId: string
  readonly state: AgentProgressState
  /** Passe en cours, ou la dernière. */
  readonly pass?: number
  readonly nature?: PassNature
  readonly specVersion?: number
  /** Verdict d'un QA, une fois son rapport lu. */
  readonly verdict?: QaVerdict
  /** Pourquoi l'agent s'est arrêté ou a été bloqué. */
  readonly message?: string
  /** Rapport de la dernière passe finie (coupé à `REPORT_MAX` caractères). */
  readonly report?: string
}

/** Au-delà, le rapport d'un agent est coupé dans le suivi (le rapport entier reste sur sa branche). */
export const REPORT_MAX = 20_000

/**
 * Assemblage dessiné sur la carte, avant d'être lancé (T006, L1o D10) : les agents connectés à un nœud et les liens qui
 * disent qui attend qui. Pas encore un travail : il se modifie jusqu'au lancement, et se retrouve à la réouverture.
 */
export interface AssemblySketchView {
  /** Nœud auquel les agents sont connectés : idée, étape ou module. */
  readonly nodeId: string
  readonly genesisId: string
  /** Identifiant de la tâche (nom des branches `agents/<tâche>/<agent>`). */
  readonly taskId: string
  /** Ce qui est demandé, en ses mots (facultatif). */
  readonly task?: string
  readonly agents: readonly AssemblyAgent[]
  readonly links: readonly AssemblyLink[]
  /** Équipe d'un lot (L1o D25) : plan du PO et aiguillages retouchés ; absent hors d'un lot cadré. */
  readonly lot?: SketchLot
}

export interface AssemblyRunView {
  /** Genesis (projet) de la tâche. */
  readonly genesisId: string
  /** Nœud auquel l'assemblage est connecté : idée, tâche ou module. */
  readonly nodeId: string
  readonly taskId: string
  readonly state: AssemblyRunState
  readonly startedAt: number
  readonly finishedAt?: number
  /** Ce que les modes de permissions et les zones empêcheront ou risquent (signalé au lancement). */
  readonly warnings: readonly string[]
  /** État en direct de chaque agent, dans l'ordre de l'assemblage. */
  readonly agents: readonly AgentLiveView[]
  /** Résultat du dernier tour de chaque agent, une fois l'assemblage fini. */
  readonly result?: AssemblyRunResult
  /** Issue de l'accord de fusion de mentalyas. */
  readonly approval?: ApprovalResult
  /** Erreur inattendue du moteur (état `failed`). */
  readonly error?: string
}

/** Agent posé libre sur la carte d'un projet (L1o D26) : appelé depuis le tiroir, pas encore relié à un nœud. */
export interface BenchAgentView {
  readonly id: string
  readonly genesisId: string
  readonly profileId: string
  /** Place sur la carte, en unités de la carte. */
  readonly x: number
  readonly y: number
}
