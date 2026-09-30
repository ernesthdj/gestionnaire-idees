import { z } from 'zod'
import { BLOCK_KINDS, BLOCK_LIMITS, LABEL_MAX_CHARS } from '@shared/ipc/canvas'
import type { CanvasService } from '../application/canvas/CanvasService'
import { defineRoute, type IpcRoute } from './registry'

/** Coordonnées de la carte : finies et bornées (aucune valeur extrême stockée). */
export const Coordinate = z.number().finite().min(-1_000_000).max(1_000_000)
/** Borne large commune ; les bornes propres à chaque type sont vérifiées par le service. */
const Size = z
  .number()
  .finite()
  .min(Math.min(...Object.values(BLOCK_LIMITS).map((limits) => Math.min(limits.minWidth, limits.minHeight))))
  .max(Math.max(...Object.values(BLOCK_LIMITS).map((limits) => Math.max(limits.maxWidth, limits.maxHeight))))

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
      channel: 'canvas:saveStepPosition',
      input: z.object({ rootId: z.uuid(), x: Coordinate, y: Coordinate }).strict(),
      handler: async (input) => {
        canvas.saveStepPosition(input)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'canvas:savePositions',
      input: z
        .object({
          positions: z
            .array(
              z.object({ neuronId: z.uuid(), x: Coordinate, y: Coordinate, pinned: z.boolean().optional() }).strict()
            )
            .max(1000)
        })
        .strict(),
      handler: async ({ positions }) => {
        canvas.savePositions(
          positions.map(({ pinned, ...position }) => (pinned === undefined ? position : { ...position, pinned }))
        )
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'canvas:createBlock',
      input: z.object({ kind: z.enum(BLOCK_KINDS).default('empty'), x: Coordinate, y: Coordinate }).strict(),
      handler: async (input) => canvas.createBlock(input)
    }),
    defineRoute({
      channel: 'canvas:updateBlock',
      input: z
        .object({
          id: z.uuid(),
          x: Coordinate,
          y: Coordinate,
          width: Size,
          height: Size,
          text: z.string().max(LABEL_MAX_CHARS).optional()
        })
        .strict(),
      handler: async ({ text, ...geometry }) =>
        canvas.updateBlock({ ...geometry, ...(text === undefined ? {} : { text }) })
    }),
    defineRoute({
      channel: 'canvas:deleteBlock',
      input: z.object({ id: z.uuid() }).strict(),
      handler: async ({ id }) => canvas.deleteBlock(id)
    })
  ]
}
