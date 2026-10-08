import { z } from 'zod'
import type { PlanService } from '../application/plan/PlanService'
import { Coordinate } from './canvasHandlers'
import { defineRoute, type IpcRoute } from './registry'

/** Fantômes d'une couche décidés d'un coup : au plus la taille d'une couche, sans doublon. */
const ItemIds = z.array(z.uuid()).max(12)

/** Canaux `plan:*` (spec 011 contracts/ipc.md) — chaque charge utile est validée. */
export function createPlanRoutes(plan: Pick<PlanService, 'decide' | 'move' | 'setFolded'>): IpcRoute[] {
  return [
    defineRoute({
      channel: 'plan:decide',
      input: z
        .object({ proposalId: z.uuid(), accept: ItemIds, reject: ItemIds })
        .strict()
        .refine(
          (input) => new Set([...input.accept, ...input.reject]).size === input.accept.length + input.reject.length,
          {
            message: 'Une étape ne peut être à la fois acceptée et refusée'
          }
        ),
      handler: async (input) => plan.decide(input)
    }),
    defineRoute({
      channel: 'plan:move',
      input: z.object({ stepId: z.uuid(), x: Coordinate, y: Coordinate }).strict(),
      handler: async ({ stepId, x, y }) => {
        plan.move(stepId, x, y)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'plan:setCollapsed',
      input: z.object({ neuronId: z.uuid(), collapsed: z.boolean() }).strict(),
      handler: async ({ neuronId, collapsed }) => {
        plan.setFolded(neuronId, collapsed)
        return { ok: true }
      }
    })
  ]
}
