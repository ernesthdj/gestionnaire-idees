import { eq } from 'drizzle-orm'
import type { BenchAgentView } from '@shared/ipc/assemblies'
import type { AppDatabase } from '../client'
import { agentBench } from '../schemaAgents'

/** Agents posés libres sur la carte d'un projet (L1o D26) : une ligne par agent, supprimée quand il est relié. */
export class AgentBenchRepository {
  constructor(private readonly db: AppDatabase) {}

  list(genesisId: string): BenchAgentView[] {
    return this.db
      .select({
        id: agentBench.id,
        genesisId: agentBench.genesisId,
        profileId: agentBench.profileId,
        x: agentBench.x,
        y: agentBench.y
      })
      .from(agentBench)
      .where(eq(agentBench.genesisId, genesisId))
      .all()
  }

  find(id: string): BenchAgentView | undefined {
    return this.db
      .select({
        id: agentBench.id,
        genesisId: agentBench.genesisId,
        profileId: agentBench.profileId,
        x: agentBench.x,
        y: agentBench.y
      })
      .from(agentBench)
      .where(eq(agentBench.id, id))
      .get()
  }

  save(agent: BenchAgentView): void {
    const values = { ...agent, updatedAt: Date.now() }
    this.db.insert(agentBench).values(values).onConflictDoUpdate({ target: agentBench.id, set: values }).run()
  }

  remove(id: string): void {
    this.db.delete(agentBench).where(eq(agentBench.id, id)).run()
  }
}
