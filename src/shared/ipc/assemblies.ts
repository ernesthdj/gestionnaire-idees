import type { ApprovalResult, AssemblyRunResult } from '../agents/pipeline'

/** Assemblages d'agents connectés à un nœud (docs/TACHES-AGENTS.md T005, L1o D1 et D12). */

export type AssemblyRunState = 'running' | 'finished' | 'failed'

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
  /** Résultat du dernier tour de chaque agent, une fois l'assemblage fini. */
  readonly result?: AssemblyRunResult
  /** Issue de l'accord de fusion de mentalyas. */
  readonly approval?: ApprovalResult
  /** Erreur inattendue du moteur (état `failed`). */
  readonly error?: string
}
