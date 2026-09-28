import type { Effort, Engine, TaskKind } from './types'

export type RoutingTable = Readonly<Record<TaskKind, Engine>>

/** Table par défaut (spec 001 FR-002) : tâches simples en local, raisonnement profond sur Claude. */
export const DEFAULT_ROUTING: RoutingTable = {
  categoriser: 'ollama',
  resumer: 'ollama',
  anonymiser: 'ollama',
  briefing_texte: 'ollama',
  etendre: 'claude',
  synthetiser: 'claude',
  reviser: 'claude',
  suggerer_liens: 'claude',
  suggerer: 'claude'
}

const EFFORT: Readonly<Record<TaskKind, Effort>> = {
  categoriser: 'low',
  resumer: 'low',
  anonymiser: 'low',
  briefing_texte: 'low',
  etendre: 'low',
  suggerer_liens: 'medium',
  synthetiser: 'high',
  reviser: 'high',
  suggerer: 'high'
}

const MAX_TOKENS: Readonly<Record<TaskKind, number>> = {
  categoriser: 256,
  resumer: 2000,
  anonymiser: 4000,
  briefing_texte: 1000,
  etendre: 4000,
  suggerer_liens: 2000,
  synthetiser: 16000,
  reviser: 16000,
  suggerer: 8000
}

export function resolveEngine(kind: TaskKind, routing: RoutingTable): Engine {
  return routing[kind]
}

export function effortFor(kind: TaskKind): Effort {
  return EFFORT[kind]
}

export function maxTokensFor(kind: TaskKind): number {
  return MAX_TOKENS[kind]
}
