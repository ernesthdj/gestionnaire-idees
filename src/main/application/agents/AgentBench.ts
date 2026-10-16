import { randomUUID } from 'node:crypto'
import type { BenchAgentView } from '@shared/ipc/assemblies'
import { AppError } from '../../domain/errors'

/** Au-delà, la carte d'un projet est encombrée : on relie ou on retire d'abord. */
export const BENCH_MAX = 40

export interface AgentBenchDeps {
  readonly repository: {
    list(genesisId: string): BenchAgentView[]
    find(id: string): BenchAgentView | undefined
    save(agent: BenchAgentView): void
    remove(id: string): void
  }
  readonly profileExists: (profileId: string) => boolean
  /** Projet (genesis) vivant et lié à un dossier : seuls ceux-là accueillent des agents. */
  readonly projectExists: (genesisId: string) => boolean
  readonly newId?: () => string
}

/**
 * Agents posés libres sur la carte d'un projet (L1o D26) : glissés depuis le tiroir, ils attendent d'être reliés à un
 * nœud (le lien les connecte, puis les retire d'ici). Place arrondie à l'unité de la carte.
 */
export class AgentBench {
  constructor(private readonly deps: AgentBenchDeps) {}

  list(genesisId: string): BenchAgentView[] {
    return this.deps.repository.list(genesisId)
  }

  place(genesisId: string, profileId: string, x: number, y: number): BenchAgentView {
    if (!this.deps.projectExists(genesisId)) throw new AppError('NOT_FOUND', 'Projet introuvable.')
    if (!this.deps.profileExists(profileId)) throw new AppError('NOT_FOUND', 'Ce profil d’agent n’existe plus.')
    if (this.deps.repository.list(genesisId).length >= BENCH_MAX) {
      throw new AppError('CONFLICT', 'Trop d’agents libres sur cette carte : relie-en ou retire-en d’abord.')
    }
    const agent: BenchAgentView = {
      id: (this.deps.newId ?? randomUUID)(),
      genesisId,
      profileId,
      x: Math.round(x),
      y: Math.round(y)
    }
    this.deps.repository.save(agent)
    return agent
  }

  move(id: string, x: number, y: number): BenchAgentView {
    const agent = this.deps.repository.find(id)
    if (agent === undefined) throw new AppError('NOT_FOUND', 'Cet agent libre n’est plus sur la carte.')
    const moved = { ...agent, x: Math.round(x), y: Math.round(y) }
    this.deps.repository.save(moved)
    return moved
  }

  remove(id: string): void {
    this.deps.repository.remove(id)
  }
}
