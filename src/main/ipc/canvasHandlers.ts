import { z } from 'zod'
import { BLOCK_SIZE_LIMITS } from '@shared/ipc/canvas'
import type { CanvasService } from '../application/canvas/CanvasService'
import { defineRoute, type IpcRoute } from './registry'

/** Coordonnées de la carte : finies et bornées (aucune valeur extrême stockée). */
const Coordinate = z.number().finite().min(-1_000_000).max(1_000_000)
const Size = z.number().finite().min(BLOCK_SIZE_LIMITS.min).max(BLOCK_SIZE_LIMITS.max)

/** Canaux de l'écran Idées (spec 003 contracts § Écran Idées). */
export function createCanvasRoutes(canvas: CanvasService): IpcRoute[] {
  return [
    defineRoute({
      channel: 'canvas:get',
      input: z
        .object({
          nature: z.enum(['action', 'reflection']).optional(),
          categoryId: z.string().min(1).max(40).optional(),
          search: z.string().trim().min(1).max(100).optional()
        })
        .strict(),
      handler: async ({ nature, categoryId, search }) =>
        canvas.get({
          ...(nature === undefined ? {} : { nature }),
          ...(categoryId === undefined ? {} : { categoryId }),
          ...(search === undefined ? {} : { search })
        })
    }),
    defineRoute({
      channel: 'canvas:savePositions',
      input: z
        .object({
          positions: z.array(z.object({ rootId: z.uuid(), x: Coordinate, y: Coordinate }).strict()).max(1000)
        })
        .strict(),
      handler: async ({ positions }) => {
        canvas.savePositions(positions)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'canvas:createBlock',
      input: z.object({ x: Coordinate, y: Coordinate }).strict(),
      handler: async (at) => canvas.createBlock(at)
    }),
    defineRoute({
      channel: 'canvas:updateBlock',
      input: z.object({ id: z.uuid(), x: Coordinate, y: Coordinate, width: Size, height: Size }).strict(),
      handler: async (block) => canvas.updateBlock(block)
    }),
    defineRoute({
      channel: 'canvas:deleteBlock',
      input: z.object({ id: z.uuid() }).strict(),
      handler: async ({ id }) => {
        canvas.deleteBlock(id)
        return { ok: true }
      }
    })
  ]
}
