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
          links: links.data
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
      updatedAt: Date.now()
    }
    this.db
      .insert(assemblySketches)
      .values(values)
      .onConflictDoUpdate({ target: assemblySketches.nodeId, set: values })
      .run()
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
