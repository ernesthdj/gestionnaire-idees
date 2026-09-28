import { z } from 'zod'
import type { HatchedRepository } from '../infrastructure/db/repositories/HatchedRepository'
import { defineRoute, type IpcRoute } from './registry'

/** Idées écloses : lecture du plan ou de la synthèse en cours (spec 003 US5). */
export function createHatchedRoutes(hatched: HatchedRepository): IpcRoute[] {
  return [
    defineRoute({
      channel: 'hatched:get',
      input: z.object({ rootId: z.uuid() }).strict(),
      handler: async ({ rootId }) => hatched.result(rootId)
    })
  ]
}
