import { z } from 'zod'
import type { ApprovalResult } from '@shared/agents/pipeline'
import type { AssemblyRunView } from '@shared/ipc/assemblies'
import type { AssemblyRequest } from '../application/agents/AssemblyService'
import { defineRoute, type IpcRoute } from './registry'

export interface AssemblyRoutesDeps {
  warnings(request: AssemblyRequest): Promise<string[]>
  start(request: AssemblyRequest): Promise<AssemblyRunView>
  cancel(genesisId: string, taskId: string): void
  approve(genesisId: string, taskId: string): Promise<ApprovalResult>
  list(genesisId?: string): AssemblyRunView[]
}

const TaskId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/)
const AgentId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/)
/** Nom de branche sûr : jamais un tiret en tête (option git), ni `..`, ni caractère de contrôle. */
const BaseBranch = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,100}$/)
  .refine((name) => !name.includes('..') && !name.endsWith('/') && !name.endsWith('.lock'))

const Agent = z.strictObject({
  id: AgentId,
  profileId: z.uuid(),
  task: z.string().max(4000).optional(),
  zone: z.array(z.string().min(1).max(260)).max(30).optional()
})

const Assembly = z.strictObject({
  nodeId: z.uuid(),
  taskId: TaskId,
  task: z.string().max(4000).optional(),
  agents: z.array(Agent).min(1).max(20),
  links: z.array(z.strictObject({ from: AgentId, to: AgentId })).max(100),
  baseBranch: BaseBranch.optional()
})

/** `exactOptionalPropertyTypes` : une propriété optionnelle absente n'est jamais passée à `undefined`. */
const toRequest = (input: z.infer<typeof Assembly>): AssemblyRequest => ({
  nodeId: input.nodeId,
  taskId: input.taskId,
  ...(input.task === undefined ? {} : { task: input.task }),
  agents: input.agents.map(({ id, profileId, task, zone }) => ({
    id,
    profileId,
    ...(task === undefined ? {} : { task }),
    ...(zone === undefined ? {} : { zone })
  })),
  links: input.links,
  ...(input.baseBranch === undefined ? {} : { baseBranch: input.baseBranch })
})

/**
 * Canaux des agents assemblés (T005) : le renderer ne donne que des identifiants, des listes fermées et du texte de
 * mission ; le contexte du nœud, le dossier du projet et les branches sont décidés par le main. Fusionner demande
 * `confirm: true` (l'accord unique de mentalyas, L1o D11).
 */
export function createAssemblyRoutes(deps: AssemblyRoutesDeps): IpcRoute[] {
  const Target = z.strictObject({ genesisId: z.uuid(), taskId: TaskId })
  return [
    defineRoute({
      channel: 'assembly:warnings',
      input: Assembly,
      handler: async (input) => deps.warnings(toRequest(input))
    }),
    defineRoute({
      channel: 'assembly:start',
      input: Assembly,
      handler: async (input) => deps.start(toRequest(input))
    }),
    defineRoute({
      channel: 'assembly:cancel',
      input: Target,
      handler: async ({ genesisId, taskId }) => {
        deps.cancel(genesisId, taskId)
        return {}
      }
    }),
    defineRoute({
      channel: 'assembly:approve',
      input: z.strictObject({ genesisId: z.uuid(), taskId: TaskId, confirm: z.literal(true) }),
      handler: async ({ genesisId, taskId }) => deps.approve(genesisId, taskId)
    }),
    defineRoute({
      channel: 'assembly:list',
      input: z.strictObject({ genesisId: z.uuid().optional() }),
      handler: async ({ genesisId }) => deps.list(genesisId)
    })
  ]
}
