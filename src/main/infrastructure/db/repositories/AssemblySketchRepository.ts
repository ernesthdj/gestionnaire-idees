import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { AssemblySketchView } from '@shared/ipc/assemblies'
import type { SketchStore } from '../../../application/agents/AssemblyService'
import type { AppDatabase } from '../client'
import { assemblySketches } from '../schemaAgents'

const Agents = z.array(
  z.object({
    id: z.string(),
    profileId: z.string(),
    task: z.string().optional(),
    zone: z.array(z.string()).optional(),
    place: z.object({ x: z.number().finite(), y: z.number().finite() }).optional()
  })
)
const Links = z.array(z.object({ from: z.string(), to: z.string() }))
const Lot = z.object({
  plan: z.object({
    steps: z.array(
      z.object({
        task: z.string(),
        agents: z.array(z.string()),
        waits: z.array(z.object({ agent: z.string(), after: z.string() }))
      })
    ),
    rhythm: z.object({ mode: z.enum(['une-a-une', 'tout']), reason: z.string() }).nullable()
  }),
  overrides: z.array(z.object({ task: z.string(), agents: z.array(z.string()), links: Links }))
})

/**
 * Croquis des agents connectés aux nœuds (T006) : un par nœud, remplacé à chaque enregistrement. Le JSON est relu avec
 * Zod ; un croquis illisible est ignoré plutôt que de casser la carte.
 */
export class AssemblySketchRepository implements SketchStore {
  constructor(private readonly db: AppDatabase) {}

  list(genesisId?: string): AssemblySketchView[] {
    const rows =
      genesisId === undefined
        ? this.db.select().from(assemblySketches).all()
        : this.db.select().from(assemblySketches).where(eq(assemblySketches.genesisId, genesisId)).all()
    return rows.flatMap((row) => {
      const agents = Agents.safeParse(parse(row.agents))
      const links = Links.safeParse(parse(row.links))
      if (!agents.success || !links.success) return []
      // Un plan de lot illisible est ignoré : l'équipe reste, sans aiguillage.
      const lot = row.lot === null ? undefined : Lot.safeParse(parse(row.lot))
      return [
        {
          nodeId: row.nodeId,
          genesisId: row.genesisId,
          taskId: row.taskId,
          ...(row.task === null ? {} : { task: row.task }),
          agents: agents.data.map(({ id, profileId, task, zone, place }) => ({
            id,
            profileId,
            ...(task === undefined ? {} : { task }),
            ...(zone === undefined ? {} : { zone }),
            ...(place === undefined ? {} : { place: { x: place.x, y: place.y } })
          })),
          links: links.data,
          ...(lot?.success === true ? { lot: lot.data } : {})
        }
      ]
    })
  }

  save(sketch: AssemblySketchView): void {
    const values = {
      nodeId: sketch.nodeId,
      genesisId: sketch.genesisId,
      taskId: sketch.taskId,
      task: sketch.task ?? null,
      agents: JSON.stringify(sketch.agents),
      links: JSON.stringify(sketch.links),
      lot: sketch.lot === undefined ? null : JSON.stringify(sketch.lot),
      updatedAt: Date.now()
    }
    this.db
      .insert(assemblySketches)
      .values(values)
      .onConflictDoUpdate({ target: assemblySketches.nodeId, set: values })
      .run()
  }

  /** Le nœud a changé de clé (spec 032 D21) : son équipe le suit, si la nouvelle clé n'en a pas déjà une. */
  moveNode(from: string, to: string): boolean {
    const target = this.db
      .select({ id: assemblySketches.nodeId })
      .from(assemblySketches)
      .where(eq(assemblySketches.nodeId, to))
      .get()
    if (target !== undefined) return false
    const result = this.db
      .update(assemblySketches)
      .set({ nodeId: to, updatedAt: Date.now() })
      .where(eq(assemblySketches.nodeId, from))
      .run()
    return result.changes > 0
  }

  remove(nodeId: string): void {
    this.db.delete(assemblySketches).where(eq(assemblySketches.nodeId, nodeId)).run()
  }
}

const parse = (json: string): unknown => {
  try {
    return JSON.parse(json)
  } catch {
    return undefined
  }
}
