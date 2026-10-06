import { z } from 'zod'
import type { CommandService } from '../application/finals/CommandService'
import type { ExecutionService } from '../application/finals/ExecutionService'
import type { FinalService } from '../application/finals/FinalService'
import { COMMAND_LIMITS, SCRIPT_NAME } from '../domain/finals/commands'
import { DELIVERABLE_SIZE_LIMITS } from '@shared/ipc/finals'
import { Coordinate } from './canvasHandlers'
import { defineRoute, type IpcRoute } from './registry'

/** Canaux `final:*` (spec 013 contracts/interfaces.md) — chaque charge utile est validée. */
export function createFinalRoutes(
  finals: Pick<FinalService, 'decide' | 'demote' | 'move' | 'resize'>,
  executions: Pick<ExecutionService, 'execute' | 'stop'>,
  commands?: Pick<CommandService, 'list' | 'approve'>
): IpcRoute[] {
  return [
    defineRoute({
      channel: 'final:decide',
      input: z.object({ neuronId: z.uuid(), accept: z.boolean() }).strict(),
      handler: async ({ neuronId, accept }) => finals.decide(neuronId, accept)
    }),
    defineRoute({
      channel: 'final:demote',
      input: z.object({ neuronId: z.uuid() }).strict(),
      handler: async ({ neuronId }) => finals.demote(neuronId)
    }),
    ...(commands === undefined
      ? []
      : [
          defineRoute({
            channel: 'commands:get',
            input: z.object({ genesisId: z.uuid() }).strict(),
            handler: async ({ genesisId }) => commands.list(genesisId)
          }),
          defineRoute({
            channel: 'commands:approve',
            input: z
              .object({
                genesisId: z.uuid(),
                scripts: z.array(z.string().regex(SCRIPT_NAME)).max(COMMAND_LIMITS.approved)
              })
              .strict(),
            handler: async ({ genesisId, scripts }) => {
              commands.approve(genesisId, scripts)
              return { ok: true }
            }
          })
        ]),
    defineRoute({
      channel: 'deliverable:move',
      input: z.object({ neuronId: z.uuid(), x: Coordinate, y: Coordinate }).strict(),
      handler: async ({ neuronId, x, y }) => {
        finals.move(neuronId, x, y)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'deliverable:resize',
      input: z
        .object({
          neuronId: z.uuid(),
          width: z.number().finite().min(DELIVERABLE_SIZE_LIMITS.minWidth).max(DELIVERABLE_SIZE_LIMITS.maxWidth),
          height: z.number().finite().min(DELIVERABLE_SIZE_LIMITS.minHeight).max(DELIVERABLE_SIZE_LIMITS.maxHeight)
        })
        .strict(),
      handler: async ({ neuronId, width, height }) => {
        finals.resize(neuronId, width, height)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'final:execute',
      input: z.object({ neuronId: z.uuid(), force: z.boolean().optional() }).strict(),
      handler: async ({ neuronId, force }) => executions.execute(neuronId, force === undefined ? {} : { force })
    }),
    defineRoute({
      channel: 'final:stop',
      input: z.object({ neuronId: z.uuid() }).strict(),
      handler: async ({ neuronId }) => {
        executions.stop(neuronId)
        return { ok: true }
      }
    })
  ]
}
