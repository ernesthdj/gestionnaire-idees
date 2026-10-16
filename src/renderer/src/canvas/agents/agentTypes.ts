import type { Edge, Node } from '@xyflow/react'
import type { PassNature } from '@shared/agents/pipeline'
import type { AgentProfileView, AgentRole } from '@shared/agents/profile'

/** Ce que le nœud d'un agent montre de son travail (T006, L1o D10). */
export type AgentVisual =
  'sketch' | 'waiting' | 'running' | 'done' | 'validated' | 'merged' | 'sent-back' | 'blocked' | 'failed' | 'cancelled'

export type AgentNodeData = {
  /** Nœud de la carte auquel l'agent est connecté. */
  readonly hostId: string
  readonly genesisId: string
  readonly hostTitle: string
  readonly taskId: string
  readonly agentId: string
  /** Profil de l'agent : son personnage et sa chambre en sont tirés (L1o D13). */
  readonly profileId: string
  /** Travail livré par son profil : enrichit sa chambre. */
  readonly delivered: number
  /** Nom du profil ; l'identifiant de l'agent à défaut (profil supprimé). */
  readonly name: string
  readonly role: AgentRole | null
  readonly visual: AgentVisual
  readonly pass: number | null
  readonly nature: PassNature | null
  /** 0 à 1 ; `null` : le travail est en cours, sans mesure (barre qui défile). */
  readonly progress: number | null
  /** Son volet est affiché dans le panneau de droite. */
  readonly open: boolean
}
export type AgentNodeType = Node<AgentNodeData, 'agent'>

/**
 * Ce que le trait montre : `idle` (croquis), `waiting` (l'amont n'a pas fini), `flowing` (l'amont a fini, l'aval
 * travaille : le résultat passe), `done`, `error`, `context` (le nœud d'idée vers un agent qui n'attend personne).
 */
export type AgentLinkPhase = 'idle' | 'waiting' | 'flowing' | 'done' | 'error' | 'context'
export type AgentLinkData = { readonly phase: AgentLinkPhase }
export type AgentEdgeType = Edge<AgentLinkData, 'agentLink'>

/**
 * Identifiant du nœud React Flow d'un agent : `agent:<agent>:<nœud>`. L'agent ne contient jamais `:` ; le nœud, clé de
 * la vue Workflow (`wf:<genesis>:<sorte>:…`, L1o D14), en contient : il prend tout le reste.
 */
export const agentNodeId = (hostId: string, agentId: string): string => `agent:${agentId}:${hostId}`

export function parseAgentNodeId(id: string): { readonly hostId: string; readonly agentId: string } | null {
  const [prefix, agentId, ...rest] = id.split(':')
  const hostId = rest.join(':')
  if (prefix !== 'agent' || agentId === undefined || agentId === '' || hostId === '') return null
  return { hostId, agentId }
}

/** Agent posé libre sur la carte (L1o D26) : sa carte d'identité, en attente d'un lien vers un nœud. */
export type BenchAgentNodeData = {
  readonly benchId: string
  readonly genesisId: string
  readonly profile: AgentProfileView
}
export type BenchAgentNodeType = Node<BenchAgentNodeData, 'benchAgent'>

/** Identifiant de carte d'un agent libre : `bench:<id>`. */
export const benchNodeId = (benchId: string): string => `bench:${benchId}`
export const parseBenchNodeId = (nodeId: string): string | null =>
  nodeId.startsWith('bench:') ? nodeId.slice('bench:'.length) : null
