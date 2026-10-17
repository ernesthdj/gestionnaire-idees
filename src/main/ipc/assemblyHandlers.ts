import { z } from 'zod'
import type { ApprovalResult, AssemblyLink, CleanupResult } from '@shared/agents/pipeline'
import type { AssemblyRunView, AssemblySketchView } from '@shared/ipc/assemblies'
import { WORKFLOW_KEY } from '@shared/ipc/workflow'
import type { AssemblyRequest } from '../application/agents/AssemblyService'
import { defineRoute, type IpcRoute } from './registry'

export interface AssemblyRoutesDeps {
  warnings(request: AssemblyRequest): Promise<string[]>
  start(request: AssemblyRequest): Promise<AssemblyRunView>
  cancel(genesisId: string, taskId: string): void
  approve(genesisId: string, taskId: string): Promise<ApprovalResult>
  cleanup(genesisId: string, taskId: string): Promise<CleanupResult>
  list(genesisId?: string): AssemblyRunView[]
  sketches(genesisId?: string): AssemblySketchView[]
  saveSketch(request: Omit<AssemblyRequest, 'baseBranch'>): AssemblySketchView
  clearSketch(nodeId: string): void
  moveSketch(fromNodeId: string, toNodeId: string, taskId: string): AssemblySketchView
  relinkSketch(fromNodeId: string, toNodeId: string): AssemblySketchView
  routeTask(
    nodeId: string,
    task: string,
    route: { readonly agents: readonly string[]; readonly links: readonly AssemblyLink[] } | null
  ): AssemblySketchView
}

/** Nœud de la vue Workflow auquel les agents sont connectés (L1o D14) : sa clé de carte `wf:<genesis>:<sorte>:…`. */
const HostId = z.string().max(160).regex(WORKFLOW_KEY)
const TaskId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/)
const AgentId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/)
/** Nom de branche sûr : jamais un tiret en tête (option git), ni `..`, ni caractère de contrôle. */
const BaseBranch = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,100}$/)
  .refine((name) => !name.includes('..') && !name.endsWith('/') && !name.endsWith('.lock'))

/** Décalage d'un agent par rapport à son nœud, en unités de la carte (borné : une carte ne s'étend pas à l'infini). */
const Coordinate = z.number().finite().min(-100_000).max(100_000)

const Agent = z.strictObject({
  id: AgentId,
  profileId: z.uuid(),
  task: z.string().max(4000).optional(),
  zone: z.array(z.string().min(1).max(260)).max(30).optional(),
  place: z.strictObject({ x: Coordinate, y: Coordinate }).optional()
})

const Assembly = z.strictObject({
  nodeId: HostId,
  taskId: TaskId,
  task: z.string().max(4000).optional(),
  agents: z.array(Agent).min(1).max(20),
  links: z.array(z.strictObject({ from: AgentId, to: AgentId })).max(100),
  baseBranch: BaseBranch.optional()
})

/** Croquis : un assemblage sans branche de base (elle se choisit au lancement). */
const Sketch = Assembly.omit({ baseBranch: true })

/** `exactOptionalPropertyTypes` : une propriété optionnelle absente n'est jamais passée à `undefined`. */
const toRequest = (input: z.infer<typeof Assembly> | z.infer<typeof Sketch>): AssemblyRequest => ({
  nodeId: input.nodeId,
  taskId: input.taskId,
  ...(input.task === undefined ? {} : { task: input.task }),
  agents: input.agents.map(({ id, profileId, task, zone, place }) => ({
    id,
    profileId,
    ...(task === undefined ? {} : { task }),
    ...(zone === undefined ? {} : { zone }),
    ...(place === undefined ? {} : { place })
  })),
  links: input.links,
  ...('baseBranch' in input && input.baseBranch !== undefined ? { baseBranch: input.baseBranch } : {})
})

/**
 * Canaux des agents assemblés (T005) : le renderer ne donne que des identifiants, des listes fermées et du texte de
 * mission ; le contexte du nœud, le dossier du projet et les branches sont décidés par le main. Fusionner demande
 * `confirm: true` (l'accord unique de mentalyas, L1o D11).
 */
export function createAssemblyRoutes(
  deps: AssemblyRoutesDeps,
  chats?: {
    open(hostId: string, agentId: string): { readonly neuronId: string }
    openProfile(profileId: string): { readonly neuronId: string }
  }
): IpcRoute[] {
  const Target = z.strictObject({ genesisId: z.uuid(), taskId: TaskId })
  return [
    ...(chats === undefined
      ? []
      : [
          // Visio avec un agent (L1o D13) : la conversation de cet agent sur ce nœud, ensuite menée par `chat:*`.
          defineRoute({
            channel: 'assembly:chat',
            input: z.strictObject({ nodeId: HostId, agentId: AgentId }),
            handler: async ({ nodeId, agentId }) => chats.open(nodeId, agentId)
          }),
          // Tête-à-tête avec un agent hors de toute tâche (L1o D22), depuis la gestion des agents.
          defineRoute({
            channel: 'agents:chat',
            input: z.strictObject({ profileId: z.uuid() }),
            handler: async ({ profileId }) => chats.openProfile(profileId)
          })
        ]),
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
    // Aiguillage d'une tâche du lot retouché à la main, ou rendu au plan du PO (L1o D25, T023).
    defineRoute({
      channel: 'assembly:lotRoute',
      input: z.strictObject({
        nodeId: HostId,
        task: z.string().min(1).max(80),
        route: z
          .strictObject({
            agents: z.array(AgentId).min(1).max(20),
            links: z.array(z.strictObject({ from: AgentId, to: AgentId })).max(100),
            // Tâches dont celle-ci dépend (L1o D28).
            after: z.array(z.string().min(1).max(80)).max(60).optional()
          })
          .nullable()
      }),
      handler: async ({ nodeId, task, route }) => deps.routeTask(nodeId, task, route)
    }),
    // Une équipe dont le nœud a disparu retrouve une tâche, avec ses conversations (L1o D27).
    defineRoute({
      channel: 'assembly:sketchRelink',
      input: z.strictObject({ from: HostId, to: HostId }),
      handler: async ({ from, to }) => deps.relinkSketch(from, to)
    }),
    // L'équipe passe à une autre tâche du Workflow (L1o D24).
    defineRoute({
      channel: 'assembly:sketchMove',
      input: z.strictObject({ from: HostId, to: HostId, taskId: TaskId }),
      handler: async ({ from, to, taskId }) => deps.moveSketch(from, to, taskId)
    }),
    // Après la fusion (L1o D23) : supprime les branches des agents que la base contient.
    defineRoute({
      channel: 'assembly:cleanup',
      input: z.strictObject({ genesisId: z.uuid(), taskId: TaskId }),
      handler: async ({ genesisId, taskId }) => deps.cleanup(genesisId, taskId)
    }),
    defineRoute({
      channel: 'assembly:sketches',
      input: z.strictObject({ genesisId: z.uuid().optional() }),
      handler: async ({ genesisId }) => deps.sketches(genesisId)
    }),
    defineRoute({
      channel: 'assembly:sketchSave',
      input: Sketch,
      handler: async (input) => deps.saveSketch(toRequest(input))
    }),
    defineRoute({
      channel: 'assembly:sketchClear',
      input: z.strictObject({ nodeId: HostId }),
      handler: async ({ nodeId }) => {
        deps.clearSketch(nodeId)
        return {}
      }
    }),
    defineRoute({
      channel: 'assembly:list',
      input: z.strictObject({ genesisId: z.uuid().optional() }),
      handler: async ({ genesisId }) => deps.list(genesisId)
    })
  ]
}
