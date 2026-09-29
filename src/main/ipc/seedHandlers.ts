import { z } from 'zod'
import type { SeedService } from '../application/neurons/SeedService'
import { defineRoute, type IpcRoute } from './registry'

const Id = z.uuid()

/** Canaux `seeds:*` : graines d'idées portées par les liens (spec 003 FR-028). */
export function createSeedRoutes(seeds: SeedService): IpcRoute[] {
  return [
    defineRoute({
      channel: 'seeds:list',
      input: z.object({}).strict().optional(),
      handler: async () => seeds.list()
    }),
    defineRoute({
      channel: 'seeds:accept',
      input: z.object({ seedId: Id }).strict(),
      handler: async ({ seedId }) => seeds.accept(seedId)
    }),
    defineRoute({
      channel: 'seeds:reject',
      input: z.object({ seedId: Id }).strict(),
      handler: async ({ seedId }) => seeds.reject(seedId)
    })
  ]
}
