import type { Effort, Engine, TaskKind } from './types'

/**
 * Moteur de chaque tâche (spec 010) : la catégorisation reste locale ; un widget n'a aucun équivalent local (l'IA
 * locale ne génère pas de code, spec 004).
 */
const ENGINES: Readonly<Record<TaskKind, Engine>> = {
  categoriser: 'ollama',
  widget: 'claude'
}

const EFFORT: Readonly<Record<TaskKind, Effort>> = {
  categoriser: 'low',
  widget: 'medium'
}

const MAX_TOKENS: Readonly<Record<TaskKind, number>> = {
  categoriser: 256,
  widget: 20000
}

export function engineFor(kind: TaskKind): Engine {
  return ENGINES[kind]
}

export function effortFor(kind: TaskKind): Effort {
  return EFFORT[kind]
}

export function maxTokensFor(kind: TaskKind): number {
  return MAX_TOKENS[kind]
}
