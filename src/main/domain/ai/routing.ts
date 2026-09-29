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
  germer: 'claude',
  suggerer: 'claude',
  // Recherche web : uniquement possible avec Claude (outil serveur).
  rechercher: 'claude'
}

const EFFORT: Readonly<Record<TaskKind, Effort>> = {
  categoriser: 'low',
  resumer: 'low',
  anonymiser: 'low',
  briefing_texte: 'low',
  etendre: 'low',
  suggerer_liens: 'medium',
  germer: 'low',
  synthetiser: 'high',
  reviser: 'high',
  suggerer: 'high',
  rechercher: 'low'
}

const MAX_TOKENS: Readonly<Record<TaskKind, number>> = {
  categoriser: 256,
  resumer: 2000,
  anonymiser: 4000,
  briefing_texte: 1000,
  etendre: 4000,
  suggerer_liens: 2000,
  germer: 1000,
  synthetiser: 16000,
  reviser: 16000,
  suggerer: 8000,
  rechercher: 2000
}

/**
 * Tâches qui ne quittent JAMAIS la machine, quelle que soit la configuration :
 * anonymiser consiste à traiter le texte brut — l'envoyer à Claude annulerait sa raison d'être.
 */
const LOCAL_ONLY_KINDS: ReadonlySet<TaskKind> = new Set<TaskKind>(['anonymiser'])

/** Recherches web au plus par demande `rechercher` (coût borné : 1 centime $ chacune + lecture). */
export const MAX_WEB_SEARCHES = 2

export function isLocalOnly(kind: TaskKind): boolean {
  return LOCAL_ONLY_KINDS.has(kind)
}

export function resolveEngine(kind: TaskKind, routing: RoutingTable): Engine {
  return isLocalOnly(kind) ? 'ollama' : routing[kind]
}

export function effortFor(kind: TaskKind): Effort {
  return EFFORT[kind]
}

export function maxTokensFor(kind: TaskKind): number {
  return MAX_TOKENS[kind]
}
