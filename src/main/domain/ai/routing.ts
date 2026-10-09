import type { Effort, Engine, TaskKind } from './types'

/**
 * Moteur de chaque tâche (spec 010) : la catégorisation reste locale ; un widget n'a aucun équivalent local (l'IA
 * locale ne génère pas de code, spec 004).
 */
const ENGINES: Readonly<Record<TaskKind, Engine>> = {
  categoriser: 'ollama',
  widget: 'claude',
  // Ollama quand le projet repris est « Local uniquement » (`localOnly` de la passerelle, spec 017 R6).
  reprise_guide: 'claude',
  analyste: 'claude',
  skill_audit: 'claude',
  skill_card: 'claude',
  // Ollama pour un projet repris « Local uniquement » (`localOnly`).
  file_summary: 'claude',
  git_message: 'claude',
  git_conflict: 'claude',
  git_story: 'claude'
}

const EFFORT: Readonly<Record<TaskKind, Effort>> = {
  categoriser: 'low',
  widget: 'medium',
  reprise_guide: 'medium',
  analyste: 'high',
  skill_audit: 'medium',
  skill_card: 'medium',
  file_summary: 'low',
  git_message: 'low',
  git_conflict: 'medium',
  git_story: 'low'
}

const MAX_TOKENS: Readonly<Record<TaskKind, number>> = {
  categoriser: 256,
  widget: 20000,
  reprise_guide: 16000,
  analyste: 16000,
  skill_audit: 4000,
  skill_card: 6000,
  file_summary: 3000,
  git_message: 2000,
  git_conflict: 30000,
  git_story: 3000
}

/**
 * Tâches longues : délai propre (sinon celui du moteur) et fenêtre de contexte d'Ollama (par défaut trop petite pour
 * une entrée de ~40 000 caractères : elle serait tronquée sans erreur).
 */
const TIMEOUT_MS: Partial<Readonly<Record<TaskKind, number>>> = {
  // Un wireframe de plusieurs écrans (spec 026) dépasse souvent les 4 minutes du moteur.
  widget: 10 * 60 * 1000,
  reprise_guide: 10 * 60 * 1000,
  // L'Analyste lit le dépôt avec ses outils (spec 019, `L3-analyste-analyse.md` §2).
  analyste: 15 * 60 * 1000,
  skill_audit: 3 * 60 * 1000,
  skill_card: 3 * 60 * 1000,
  file_summary: 3 * 60 * 1000,
  git_message: 2 * 60 * 1000,
  git_conflict: 5 * 60 * 1000,
  git_story: 2 * 60 * 1000
}
const CONTEXT_TOKENS: Partial<Readonly<Record<TaskKind, number>>> = { reprise_guide: 32768, file_summary: 16384 }

export function engineFor(kind: TaskKind): Engine {
  return ENGINES[kind]
}

export function effortFor(kind: TaskKind): Effort {
  return EFFORT[kind]
}

export function maxTokensFor(kind: TaskKind): number {
  return MAX_TOKENS[kind]
}

export function timeoutFor(kind: TaskKind): number | undefined {
  return TIMEOUT_MS[kind]
}

export function contextTokensFor(kind: TaskKind): number | undefined {
  return CONTEXT_TOKENS[kind]
}
