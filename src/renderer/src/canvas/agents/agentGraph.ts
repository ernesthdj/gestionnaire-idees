import { upstreamOf, type Assembly } from '@shared/agents/pipeline'
import { AGENT_ROLE_LABELS, type AgentProfileView } from '@shared/agents/profile'
import type { AgentLiveView, AssemblyRunView, AssemblySketchView } from '@shared/ipc/assemblies'
import {
  agentNodeId,
  type AgentEdgeType,
  type AgentLinkPhase,
  type AgentNodeType,
  type AgentVisual
} from './agentTypes'

/**
 * Taille d'un nœud d'agent (multiples de 8) : sa chambre-cube, assez grande pour voir le personnage (L1o D13), puis son
 * nom et son état. Écarts de la place par défaut, sous le nœud, d'un agent jamais déplacé.
 */
export const AGENT_NODE_SIZE = { width: 256, height: 288 } as const
const COLUMN_PITCH = 288
const ROW_PITCH = 320
const HOST_CLEARANCE = 160

export const AGENT_VISUAL_LABELS: Readonly<Record<AgentVisual, string>> = {
  sketch: 'à lancer',
  waiting: 'en attente',
  running: 'au travail',
  done: 'terminé',
  validated: 'validé',
  merged: 'fusionné',
  'sent-back': 'renvoyé par le QA',
  blocked: 'bloqué',
  failed: 'en erreur',
  cancelled: 'annulé'
}

/** Assemblage le plus récent de la tâche d'un croquis ; `undefined` s'il n'a jamais été lancé. */
export function runOf(sketch: AssemblySketchView, runs: readonly AssemblyRunView[]): AssemblyRunView | undefined {
  return runs
    .filter((run) => run.nodeId === sketch.nodeId && run.taskId === sketch.taskId)
    .sort((a, b) => b.startedAt - a.startedAt)[0]
}

/**
 * Couleur et état d'un agent (T006) : en attente, au travail, terminé ; vert quand l'assemblage entier est validé par le
 * QA (puis fusionné après l'accord de mentalyas) ; rouge en erreur, orangé quand le QA renvoie le travail.
 */
export function visualOf(run: AssemblyRunView | undefined, live: AgentLiveView | undefined): AgentVisual {
  if (run === undefined || live === undefined) return 'sketch'
  // Le moteur lui-même est tombé : ceux qui attendaient ou travaillaient n'iront pas plus loin.
  if (run.state === 'failed' && (live.state === 'waiting' || live.state === 'running')) return 'failed'
  switch (live.state) {
    case 'waiting':
      return 'waiting'
    case 'running':
      return 'running'
    case 'failed':
      return 'failed'
    case 'blocked':
      return 'blocked'
    case 'cancelled':
      return 'cancelled'
    case 'done':
      if (run.approval?.merged === true) return 'merged'
      if (run.result?.completed === true) return 'validated'
      return live.verdict === 'renvoi' ? 'sent-back' : 'done'
  }
}

const progressOf = (visual: AgentVisual): number | null =>
  visual === 'running' ? null : visual === 'sketch' || visual === 'waiting' ? 0 : 1

/** Niveau de chaque agent : 0 s'il n'attend personne, sinon un de plus que le plus bas de ceux qu'il attend. */
export function levelsOf(sketch: Pick<AssemblySketchView, 'agents' | 'links'>): ReadonlyMap<string, number> {
  const assembly: Assembly = { taskId: '', brief: '', agents: sketch.agents, links: sketch.links }
  const upstream = upstreamOf(assembly)
  const levels = new Map<string, number>()
  const levelOf = (id: string, visiting: ReadonlySet<string>): number => {
    const known = levels.get(id)
    if (known !== undefined) return known
    // Une boucle est refusée à l'enregistrement ; ici on ne s'y perd pas si une base abîmée en contenait une.
    if (visiting.has(id)) return 0
    const next = new Set(visiting).add(id)
    const level = Math.max(-1, ...(upstream.get(id) ?? []).map((from) => levelOf(from, next))) + 1
    levels.set(id, level)
    return level
  }
  for (const agent of sketch.agents) levelOf(agent.id, new Set())
  return levels
}

/** Le lien `from → to` créerait-il une boucle (un agent finirait par s'attendre lui-même) ? */
export function wouldCycle(
  links: readonly { readonly from: string; readonly to: string }[],
  from: string,
  to: string
): boolean {
  if (from === to) return true
  // Boucle si `from` est déjà en aval de `to`.
  const seen = new Set<string>()
  const queue = [to]
  while (queue.length > 0) {
    const id = queue.shift() as string
    if (id === from) return true
    if (seen.has(id)) continue
    seen.add(id)
    for (const link of links) if (link.from === id) queue.push(link.to)
  }
  return false
}

const linkPhase = (run: AssemblyRunView | undefined, from: AgentVisual, to: AgentVisual): AgentLinkPhase => {
  if (run === undefined) return 'idle'
  if (from === 'failed' || from === 'blocked' || to === 'failed' || to === 'blocked') return 'error'
  if (to === 'running' && from !== 'running' && from !== 'waiting') return 'flowing'
  if (from === 'waiting' || from === 'running' || to === 'waiting') return 'waiting'
  return 'done'
}

export interface AgentGraphInput {
  readonly sketches: readonly AssemblySketchView[]
  readonly runs: readonly AssemblyRunView[]
  readonly profiles: readonly AgentProfileView[]
  /** Centre des nœuds de la carte (les agents se posent sous celui auquel ils sont connectés). */
  readonly hosts: ReadonlyMap<string, { readonly x: number; readonly y: number; readonly title: string }>
  /** Nœud et agent dont le volet est affiché. */
  readonly shown: { readonly hostId: string; readonly agentId: string | null } | null
}

/**
 * Nœuds et liens des agents connectés aux nœuds de la carte (T006, L1o D10). Posés sous leur nœud, un niveau par rang
 * d'attente ; un croquis dont le nœud n'est pas dessiné (replié, autre vue) n'a ni nœud ni lien. Pur.
 */
export function agentGraph(input: AgentGraphInput): { nodes: AgentNodeType[]; edges: AgentEdgeType[] } {
  const profiles = new Map(input.profiles.map((profile) => [profile.id, profile]))
  const nodes: AgentNodeType[] = []
  const edges: AgentEdgeType[] = []
  for (const sketch of input.sketches) {
    const host = input.hosts.get(sketch.nodeId)
    if (host === undefined) continue
    const run = runOf(sketch, input.runs)
    const levels = levelsOf(sketch)
    const rows = new Map<number, string[]>()
    for (const agent of sketch.agents) {
      const level = levels.get(agent.id) ?? 0
      rows.set(level, [...(rows.get(level) ?? []), agent.id])
    }
    const visuals = new Map<string, AgentVisual>()
    for (const agent of sketch.agents) {
      const live = run?.agents.find((entry) => entry.agentId === agent.id)
      const visual = visualOf(run, live)
      visuals.set(agent.id, visual)
      const level = levels.get(agent.id) ?? 0
      const row = rows.get(level) ?? []
      const column = row.indexOf(agent.id)
      const profile = profiles.get(agent.profileId)
      nodes.push({
        id: agentNodeId(sketch.nodeId, agent.id),
        type: 'agent',
        // Posé où mentalyas l'a lâché (par rapport à son nœud, qu'il suit) ; sinon sous le nœud, un rang par niveau.
        position:
          agent.place === undefined
            ? {
                x: host.x + (column - (row.length - 1) / 2) * COLUMN_PITCH,
                y: host.y + HOST_CLEARANCE + level * ROW_PITCH
              }
            : { x: host.x + agent.place.x, y: host.y + agent.place.y },
        draggable: true,
        width: AGENT_NODE_SIZE.width,
        height: AGENT_NODE_SIZE.height,
        data: {
          profileId: agent.profileId,
          delivered: profile?.delivered ?? 0,
          hostId: sketch.nodeId,
          genesisId: sketch.genesisId,
          hostTitle: host.title,
          taskId: sketch.taskId,
          agentId: agent.id,
          name: profile?.name ?? agent.id,
          role: profile?.role ?? null,
          visual,
          pass: live?.pass ?? null,
          nature: live?.nature ?? null,
          progress: progressOf(visual),
          open: input.shown?.hostId === sketch.nodeId && input.shown.agentId === agent.id
        },
        ariaLabel: `${profile?.name ?? agent.id}${
          profile === undefined ? '' : `, ${AGENT_ROLE_LABELS[profile.role]}`
        } — ${AGENT_VISUAL_LABELS[visual]}`
      })
    }
    const waiting = upstreamOf({ taskId: '', brief: '', agents: sketch.agents, links: sketch.links })
    for (const agent of sketch.agents) {
      if ((waiting.get(agent.id) ?? []).length > 0) continue
      edges.push({
        id: `agent-context:${sketch.nodeId}:${agent.id}`,
        type: 'agentLink',
        source: sketch.nodeId,
        target: agentNodeId(sketch.nodeId, agent.id),
        selectable: false,
        focusable: false,
        data: { phase: 'context' }
      })
    }
    for (const link of sketch.links) {
      const from = visuals.get(link.from) ?? 'sketch'
      const to = visuals.get(link.to) ?? 'sketch'
      edges.push({
        id: `agent-link:${sketch.nodeId}:${link.from}>${link.to}`,
        type: 'agentLink',
        source: agentNodeId(sketch.nodeId, link.from),
        target: agentNodeId(sketch.nodeId, link.to),
        selectable: false,
        focusable: false,
        data: { phase: linkPhase(run, from, to) }
      })
    }
  }
  return { nodes, edges }
}

/** Avancement de l'assemblage : agents qui ont fini sur le total (nul si rien n'est lancé). */
export function assemblyProgress(run: AssemblyRunView | undefined): { done: number; total: number } {
  const total = run?.agents.length ?? 0
  const done = run?.agents.filter((agent) => agent.state === 'done').length ?? 0
  return { done, total }
}
