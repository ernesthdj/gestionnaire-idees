import { z } from 'zod'
import type { BenchAgentView } from '@shared/ipc/assemblies'
import { defineRoute, type IpcRoute } from './registry'

/** Place sur la carte, bornée : une carte ne s'étend pas à l'infini. */
const Coordinate = z.number().finite().min(-100_000).max(100_000)

/**
 * Agents posés libres sur la carte d'un projet (L1o D26) : poser depuis le tiroir, déplacer, retirer. Relier un agent
 * libre à un nœud passe par le croquis de ce nœud (`assembly:sketchSave`), puis `bench:remove`.
 */
export function createBenchRoutes(bench: {
  list(genesisId: string): BenchAgentView[]
  place(genesisId: string, profileId: string, x: number, y: number): BenchAgentView
  move(id: string, x: number, y: number): BenchAgentView
  remove(id: string): void
}): IpcRoute[] {
  return [
    defineRoute({
      channel: 'bench:list',
      input: z.strictObject({ genesisId: z.uuid() }),
      handler: async ({ genesisId }) => bench.list(genesisId)
    }),
    defineRoute({
      channel: 'bench:place',
      input: z.strictObject({ genesisId: z.uuid(), profileId: z.uuid(), x: Coordinate, y: Coordinate }),
      handler: async ({ genesisId, profileId, x, y }) => bench.place(genesisId, profileId, x, y)
    }),
    defineRoute({
      channel: 'bench:move',
      input: z.strictObject({ id: z.uuid(), x: Coordinate, y: Coordinate }),
      handler: async ({ id, x, y }) => bench.move(id, x, y)
    }),
    defineRoute({
      channel: 'bench:remove',
      input: z.strictObject({ id: z.uuid() }),
      handler: async ({ id }) => {
        bench.remove(id)
        return null
      }
    })
  ]
}
