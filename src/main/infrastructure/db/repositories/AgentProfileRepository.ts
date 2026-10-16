import { asc, eq, sql } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { agentProfiles } from '../schemaAgents'

export type AgentProfileRow = typeof agentProfiles.$inferSelect

/** Profils d'agents (T001) : un nom unique par profil. */
export class AgentProfileRepository {
  constructor(private readonly db: AppDatabase) {}

  list(): AgentProfileRow[] {
    return this.db.select().from(agentProfiles).orderBy(asc(agentProfiles.name)).all()
  }

  get(id: string): AgentProfileRow | undefined {
    return this.db.select().from(agentProfiles).where(eq(agentProfiles.id, id)).get()
  }

  byName(name: string): AgentProfileRow | undefined {
    return this.db.select().from(agentProfiles).where(eq(agentProfiles.name, name)).get()
  }

  insert(row: typeof agentProfiles.$inferInsert): void {
    this.db.insert(agentProfiles).values(row).run()
  }

  update(id: string, patch: Partial<Omit<typeof agentProfiles.$inferInsert, 'id' | 'createdAt'>>): void {
    this.db.update(agentProfiles).set(patch).where(eq(agentProfiles.id, id)).run()
  }

  /** Un point de travail livré par agent de l'assemblage (deux agents d'un même profil comptent deux fois). */
  addDelivered(profileIds: readonly string[]): void {
    for (const id of profileIds) {
      this.db
        .update(agentProfiles)
        .set({ delivered: sql`${agentProfiles.delivered} + 1` })
        .where(eq(agentProfiles.id, id))
        .run()
    }
  }

  delete(id: string): void {
    this.db.delete(agentProfiles).where(eq(agentProfiles.id, id)).run()
  }
}
