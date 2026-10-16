import type { AgentRole, PermissionMode } from './profile'

/**
 * Assemblages d'agents (docs/brainstorm/L1o-agents-assembles.md, T011–T012) : mentalyas assemble ses agents à la main.
 * Un lien A → B : B attend que A ait fini et part de son résultat ; sans lien, deux agents travaillent en même temps.
 */

export const AGENT_BRANCH_PREFIX = 'agents'
export const DEFAULT_BASE_BRANCH = 'main'

const AGENT_ID = /^[a-z0-9][a-z0-9-]{0,31}$/
export const isValidAgentId = (id: string): boolean => AGENT_ID.test(id)

/** Branche d'un agent : `agents/<tâche>/<agent>` (L1o D3). */
export const agentBranch = (taskId: string, agentId: string): string => `${AGENT_BRANCH_PREFIX}/${taskId}/${agentId}`

export interface AssemblyAgent {
  /** Identifiant de l'agent dans l'assemblage (deux agents peuvent partager un profil). */
  readonly id: string
  readonly profileId: string
  /** Ce que cet agent doit faire en particulier (facultatif : sinon, sa part de la spec). */
  readonly task?: string
}

export interface AssemblyLink {
  /** Agent attendu. */
  readonly from: string
  /** Agent qui attend `from` et part de son résultat. */
  readonly to: string
}

export interface Assembly {
  readonly taskId: string
  /** Le travail demandé : la tâche et le contexte du nœud (lu par le PO, ou par l'agent seul). */
  readonly brief: string
  readonly agents: readonly AssemblyAgent[]
  readonly links: readonly AssemblyLink[]
  /** Branche d'où partent les agents qui n'attendent personne (`main` par défaut). */
  readonly baseBranch?: string
}

/** Agents attendus par chacun (liens entrants), dans l'ordre de l'assemblage. */
export const upstreamOf = (assembly: Assembly): ReadonlyMap<string, readonly string[]> => {
  const map = new Map<string, string[]>(assembly.agents.map((agent) => [agent.id, []]))
  for (const link of assembly.links) map.get(link.to)?.push(link.from)
  return map
}

/**
 * Règles d'un assemblage (L1o D1, D2, D12) ; rend la première erreur, ou `null`. Identifiants uniques, liens entre
 * agents connus, aucun cycle ; dès deux agents, un PO et un seul, qui n'attend personne, et dont tous les autres
 * dépendent (directement ou non) : ils lisent sa spec.
 */
export function assemblyError(assembly: Assembly, roleOf: (agentId: string) => AgentRole | undefined): string | null {
  const { agents, links } = assembly
  if (agents.length === 0) return 'L’assemblage n’a aucun agent.'
  const ids = new Set<string>()
  for (const agent of agents) {
    if (!isValidAgentId(agent.id)) return `Identifiant d’agent invalide : « ${agent.id} ».`
    if (ids.has(agent.id)) return `Deux agents portent l’identifiant « ${agent.id} ».`
    ids.add(agent.id)
    if (roleOf(agent.id) === undefined) return `L’agent « ${agent.id} » n’a pas de profil (page Skills).`
  }
  const seen = new Set<string>()
  for (const link of links) {
    if (!ids.has(link.from) || !ids.has(link.to)) return 'Un lien relie un agent absent de l’assemblage.'
    if (link.from === link.to) return `L’agent « ${link.from} » ne peut pas s’attendre lui-même.`
    const key = `${link.from}>${link.to}`
    if (seen.has(key)) return `Lien en double : ${link.from} → ${link.to}.`
    seen.add(key)
  }
  const upstream = upstreamOf(assembly)
  if (topologicalOrder(assembly) === null) return 'Les liens forment une boucle : un agent s’attendrait lui-même.'
  if (agents.length === 1) return null

  const pos = agents.filter((agent) => roleOf(agent.id) === 'po')
  if (pos.length !== 1) return 'Un assemblage de plusieurs agents demande un Product Owner, et un seul.'
  const po = pos[0] as AssemblyAgent
  if ((upstream.get(po.id) ?? []).length > 0) return 'Le Product Owner ouvre le travail : il n’attend aucun agent.'
  const reachesPo = (id: string, visiting = new Set<string>()): boolean => {
    if (id === po.id) return true
    if (visiting.has(id)) return false
    visiting.add(id)
    return (upstream.get(id) ?? []).some((from) => reachesPo(from, visiting))
  }
  const orphan = agents.find((agent) => !reachesPo(agent.id))
  if (orphan !== undefined)
    return `L’agent « ${orphan.id} » n’est pas relié au Product Owner : il n’aurait pas sa spec.`
  return null
}

/** Ordre où chaque agent vient après ceux qu'il attend ; `null` si les liens forment une boucle. */
export function topologicalOrder(assembly: Assembly): string[] | null {
  const upstream = upstreamOf(assembly)
  const done = new Set<string>()
  const order: string[] = []
  while (order.length < assembly.agents.length) {
    const next = assembly.agents.find(
      (agent) => !done.has(agent.id) && (upstream.get(agent.id) ?? []).every((from) => done.has(from))
    )
    if (next === undefined) return null
    done.add(next.id)
    order.push(next.id)
  }
  return order
}

/** Dernière ligne du rapport du QA : `VERDICT: VALIDE` ou `VERDICT: RENVOI` (boucle QA → PO, L1o D8). */
const QA_VERDICT_LINE = /^\**\s*VERDICT\s*:\s*(VALIDE|RENVOI)\s*\**$/i

export type QaVerdict = 'valide' | 'renvoi'

export const parseQaVerdict = (report: string): QaVerdict | undefined => {
  const last = report
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .at(-1)
  const match = last === undefined ? null : QA_VERDICT_LINE.exec(last)
  if (match === null) return undefined
  return (match[1] as string).toUpperCase() === 'VALIDE' ? 'valide' : 'renvoi'
}

/** Nature d'une passe (L1o D9) : première implémentation, reprise d'une erreur relevée, ajustement à une spec changée. */
export const PASS_NATURES = ['initiale', 'correction', 'repasse'] as const
export type PassNature = (typeof PASS_NATURES)[number]

export const PASS_NATURE_LABELS: Readonly<Record<PassNature, string>> = {
  initiale: 'implémentation initiale',
  correction: 'correction d’une erreur relevée par le QA',
  repasse: 'repasse : la spec a changé là où tu travailles'
}

/** Passe d'un agent : son numéro (1, 2…), sa nature, la version de spec qu'il applique (absente : agent seul). */
export interface PassIndex {
  readonly pass: number
  readonly nature: PassNature
  readonly specVersion?: number
}

/** Dernière ligne d'une spec réécrite après un renvoi du QA : `AGENTS: back=correction, front=repasse` (L1o D8). */
const DESIGNATION_LINE = /^\**\s*AGENTS\s*:\s*(.+?)\s*\**$/i
const DESIGNATION_ITEM = /^([a-z0-9][a-z0-9-]{0,31})\s*=\s*(correction|repasse)$/i

/** Agents que le PO désigne pour repartir, avec la nature de leur passe ; `undefined` si la ligne manque ou est fausse. */
export function parseDesignation(spec: string): ReadonlyMap<string, Exclude<PassNature, 'initiale'>> | undefined {
  const last = spec
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .at(-1)
  const line = last === undefined ? null : DESIGNATION_LINE.exec(last)
  if (line === null) return undefined
  const designated = new Map<string, Exclude<PassNature, 'initiale'>>()
  for (const item of (line[1] as string).split(',')) {
    const match = DESIGNATION_ITEM.exec(item.trim())
    if (match === null) return undefined
    designated.set(match[1] as string, (match[2] as string).toLowerCase() as Exclude<PassNature, 'initiale'>)
  }
  return designated
}

/** Agents qui dépendent (directement ou non) de ceux donnés. */
export function downstreamOf(assembly: Assembly, ids: Iterable<string>): Set<string> {
  const found = new Set<string>()
  const queue = [...ids]
  while (queue.length > 0) {
    const id = queue.shift() as string
    for (const link of assembly.links) {
      if (link.from === id && !found.has(link.to)) {
        found.add(link.to)
        queue.push(link.to)
      }
    }
  }
  return found
}

/** Agents qui n'ont personne après eux : leurs branches portent tout le travail, ce sont elles que l'accord fusionne. */
export const sinksOf = (assembly: Assembly): string[] =>
  assembly.agents.filter((agent) => !assembly.links.some((link) => link.from === agent.id)).map((agent) => agent.id)

export type AgentRunStatus = 'done' | 'failed' | 'blocked' | 'cancelled'

export type AgentStopReason =
  | 'missing-spec'
  | 'agent-failed'
  | 'git-failed'
  | 'merge-conflict'
  | 'upstream-failed'
  | 'cancelled'
  | 'qa-no-verdict'
  | 'po-no-designation'

export interface AgentRunResult {
  readonly agentId: string
  readonly role: AgentRole
  readonly profileName: string
  readonly status: AgentRunStatus
  /** Dernière passe de l'agent (absente s'il n'a jamais démarré). */
  readonly index?: PassIndex
  readonly branch?: string
  /** Worktree gardé quand l'agent a échoué (pour voir où il en était) ; retiré quand il a fini. */
  readonly worktree?: string
  readonly sessionId?: string
  /** Dernier commit de la branche de l'agent. */
  readonly commit?: string
  /** Verdict d'un QA à sa dernière passe. */
  readonly verdict?: QaVerdict
  readonly stopped?: { readonly reason: AgentStopReason; readonly message: string }
}

export interface AssemblyRunResult {
  readonly taskId: string
  /**
   * Tous les agents ont fini et chaque QA a validé : les branches attendent l'accord unique de fusion de mentalyas
   * (`PipelineEngine.approve`, L1o D11).
   */
  readonly completed: boolean
  /** Tours faits : 1, plus un par renvoi du QA (aucun plafond, L1o D8). */
  readonly rounds: number
  /** Dans l'ordre de l'assemblage, dernière passe de chacun. */
  readonly agents: readonly AgentRunResult[]
}

export interface ApprovalResult {
  readonly merged: boolean
  readonly baseBranch: string
  readonly commit?: string
  readonly message?: string
}

/**
 * Ce qu'un mode de permissions empêche dans une session `claude -p`, sans personne pour répondre (L1o D11, sonde du
 * 2026-10-16) : « Demander avant d'écrire » refuse écritures et commandes, « Écrire sans demander » refuse les commandes.
 */
export function permissionWarning(profile: {
  readonly name: string
  readonly permissionMode: PermissionMode
}): string | undefined {
  if (profile.permissionMode === 'default') {
    return `« ${profile.name} » est en mode « Demander avant d’écrire » : sans personne pour répondre, il ne pourra ni écrire ni lancer de commande.`
  }
  if (profile.permissionMode === 'acceptEdits') {
    return `« ${profile.name} » est en mode « Écrire sans demander » : il écrira, mais ne pourra lancer aucune commande (tests, build).`
  }
  return undefined
}
