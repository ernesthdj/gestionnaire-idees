import type { LotPlan, LotTask } from './lotPlan'
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
  /** Zone de travail : dossiers ou fichiers du projet (chemins relatifs) que cet agent touchera (L1o D4). */
  readonly zone?: readonly string[]
  /** Place de l'agent sur la carte, par rapport à son nœud (L1o D13) ; absente : posé sous le nœud. Ignorée du moteur. */
  readonly place?: AgentPlace
}

export interface AgentPlace {
  readonly x: number
  readonly y: number
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
  /** Connecté à un lot (L1o D25) : ses tâches ; le PO écrit alors la spec du lot entier. */
  readonly lot?: readonly LotTask[]
  /** Fichier où vivent les tâches du lot : on y coche, on n'en crée pas d'autre. */
  readonly lotFile?: string
  /** Nœud de la carte où l'équipe est connectée : il donne aux agents leur identité sur le pont (L2-pipeline-optimal D11). */
  readonly hostId?: string
}

/** Agents attendus par chacun (liens entrants), dans l'ordre de l'assemblage. */
export const upstreamOf = (assembly: Assembly): ReadonlyMap<string, readonly string[]> => {
  const map = new Map<string, string[]>(assembly.agents.map((agent) => [agent.id, []]))
  for (const link of assembly.links) map.get(link.to)?.push(link.from)
  return map
}

/**
 * Forme d'un assemblage, complet ou en croquis (T006) ; rend la première erreur, ou `null`. Identifiants valides et
 * uniques, zones relatives au projet, liens entre agents connus sans doublon ni boucle. Avec `roleOf`, chaque agent doit
 * aussi avoir un profil.
 */
export function structureError(assembly: Assembly, roleOf?: (agentId: string) => AgentRole | undefined): string | null {
  const { agents, links } = assembly
  if (agents.length === 0) return 'L’assemblage n’a aucun agent.'
  const ids = new Set<string>()
  for (const agent of agents) {
    if (!isValidAgentId(agent.id)) return `Identifiant d’agent invalide : « ${agent.id} ».`
    if (ids.has(agent.id)) return `Deux agents portent l’identifiant « ${agent.id} ».`
    ids.add(agent.id)
    if (roleOf !== undefined && roleOf(agent.id) === undefined)
      return `L’agent « ${agent.id} » n’a pas de profil (page Skills).`
    const badPath = (agent.zone ?? []).find((path) => normalizeZonePath(path) === undefined)
    if (badPath !== undefined)
      return `Zone invalide pour « ${agent.id} » : « ${badPath} » (chemin relatif au projet attendu).`
  }
  const seen = new Set<string>()
  for (const link of links) {
    if (!ids.has(link.from) || !ids.has(link.to)) return 'Un lien relie un agent absent de l’assemblage.'
    if (link.from === link.to) return `L’agent « ${link.from} » ne peut pas s’attendre lui-même.`
    const key = `${link.from}>${link.to}`
    if (seen.has(key)) return `Lien en double : ${link.from} → ${link.to}.`
    seen.add(key)
  }
  if (topologicalOrder(assembly) === null) return 'Les liens forment une boucle : un agent s’attendrait lui-même.'
  return null
}

/**
 * Règles d'un assemblage à lancer (L1o D1, D2, D12) ; rend la première erreur, ou `null`. Forme valide (`structureError`) ;
 * dès deux agents, un PO et un seul, qui n'attend personne, et dont tous les autres dépendent (directement ou non) :
 * ils lisent sa spec.
 */
export function assemblyError(assembly: Assembly, roleOf: (agentId: string) => AgentRole | undefined): string | null {
  const shape = structureError(assembly, roleOf)
  if (shape !== null) return shape
  const { agents } = assembly
  const upstream = upstreamOf(assembly)
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

/**
 * Chemin de zone normalisé (`/`, sans `./` ni `/` final) ; `undefined` s'il sort du projet (absolu, `..`, lecteur) ou
 * est vide. `.` désigne tout le projet.
 */
export function normalizeZonePath(path: string): string | undefined {
  const parts = path
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part !== '' && part !== '.')
  const raw = path.trim().replace(/\\/g, '/')
  if (raw === '' || raw.startsWith('/') || /^[a-z]:/i.test(raw) || parts.includes('..')) return undefined
  return parts.join('/')
}

/** Deux chemins normalisés se recouvrent quand l'un est l'autre ou le dossier qui contient l'autre (`''` = tout). */
const pathsOverlap = (a: string, b: string): boolean => {
  // Windows ne distingue pas les majuscules : `src/App` et `src/app` sont le même dossier.
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  return x === '' || y === '' || x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`)
}

export interface ZoneOverlap {
  /** Les deux agents qui travaillent en même temps. */
  readonly first: string
  readonly second: string
  /** Chemins en commun (le plus précis des deux à chaque fois). */
  readonly paths: readonly string[]
  /** Lien proposé pour les mettre en séquence : `first` d'abord (dans l'ordre de l'assemblage). */
  readonly suggestedLink: AssemblyLink
}

/**
 * Agents en parallèle (aucun n'attend l'autre, même de loin) dont les zones déclarées se recouvrent (L1o D4). Un agent
 * sans zone n'est jamais signalé : on ne devine rien. Zones invalides ignorées (`assemblyError` les refuse).
 */
export function zoneOverlaps(assembly: Assembly): ZoneOverlap[] {
  const zones = new Map<string, string[]>()
  for (const agent of assembly.agents) {
    const paths = (agent.zone ?? []).map(normalizeZonePath).filter((p): p is string => p !== undefined)
    if (paths.length > 0) zones.set(agent.id, paths)
  }
  const overlaps: ZoneOverlap[] = []
  const ids = assembly.agents.map((agent) => agent.id)
  ids.forEach((first, i) => {
    const after = downstreamOf(assembly, [first])
    for (const second of ids.slice(i + 1)) {
      const a = zones.get(first)
      const b = zones.get(second)
      if (a === undefined || b === undefined || after.has(second)) continue
      if (downstreamOf(assembly, [second]).has(first)) continue
      const shared = new Set<string>()
      for (const x of a) for (const y of b) if (pathsOverlap(x, y)) shared.add(x.length >= y.length ? x : y)
      if (shared.size > 0)
        overlaps.push({ first, second, paths: [...shared], suggestedLink: { from: first, to: second } })
    }
  })
  return overlaps
}

/** Phrase d'avertissement pour mentalyas : qui se chevauche, où, et le lien proposé. */
export const zoneOverlapWarning = (overlap: ZoneOverlap): string => {
  const where = overlap.paths.map((path) => (path === '' ? 'tout le projet' : `« ${path} »`)).join(', ')
  return `« ${overlap.first} » et « ${overlap.second} » travaillent en même temps sur ${where} : leurs branches risquent de se contredire. Relier ${overlap.first} → ${overlap.second} les mettrait à la suite.`
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

/** Début de l'avertissement « copie de travail non commitée » (L1o D20) : le volet y ajoute un bouton vers le Dépôt. */
export const UNCOMMITTED_MARK = 'Copie de travail modifiée'

export type AgentStopReason =
  | 'missing-spec'
  | 'agent-failed'
  | 'git-failed'
  | 'merge-conflict'
  | 'upstream-failed'
  | 'cancelled'
  | 'qa-no-verdict'
  | 'po-no-designation'
  /** Ses écritures ont été refusées (mode de permission du profil) et il n'a rien changé (L1o D20). */
  | 'permission-denied'
  /** L'Architecte a trouvé un trou dans la spec : il attend que le PO l'amende (L2-pipeline-optimal D1). */
  | 'spec-question'

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
  /** Consommation de sa dernière passe (L2-pipeline-optimal D10), si sa session a tourné. */
  readonly usage?: PassUsage
}

/**
 * Consommation d'une passe d'agent (L2-pipeline-optimal D10, T015), lue dans le flux de sa session. La jauge des 5 h
 * est relevée au début et à la fin de la passe : avec des agents en parallèle, l'écart compte aussi leur consommation.
 */
export interface PassUsage {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
  /** Coût indicatif en dollars (tarif public ; l'abonnement ne le facture pas). */
  readonly costUsd: number | null
  /** Tours de la session (appels au modèle). */
  readonly turns: number | null
  /** Outils appelés pendant la passe. */
  readonly tools: number
  readonly durationMs: number | null
  /** Part utilisée (0–1) de la jauge des 5 h au premier et au dernier relevé de la passe ; `null` sans relevé. */
  readonly fiveHourStart: number | null
  readonly fiveHourEnd: number | null
}

/** Une passe dans le relevé de consommation d'un projet (L2-pipeline-optimal D10) : qui, quoi, combien. */
export interface UsageRecord {
  readonly at: number
  readonly taskId: string
  readonly agentId: string
  readonly role: AgentRole
  readonly profileId: string
  readonly pass: number
  readonly nature: PassNature
  /** La session a rendu un rapport. */
  readonly ok: boolean
  readonly usage: PassUsage
}

/**
 * État d'un agent pendant l'assemblage (T006, L1o D10) : il attend ceux qu'il suit, travaille, a fini, a échoué,
 * est bloqué (un agent attendu n'a pas abouti) ou a été annulé.
 */
export type AgentProgressState = 'waiting' | 'running' | 'done' | 'failed' | 'blocked' | 'cancelled'

/** Changement d'état d'un agent, émis par le planificateur au fil de l'eau (le nœud de l'agent s'anime dessus). */
export interface AgentProgress {
  readonly agentId: string
  readonly state: AgentProgressState
  /** Passe en cours ou dernière passe de l'agent. */
  readonly index?: PassIndex
  /** Verdict du QA, une fois lu : vert (valide) ou renvoi. */
  readonly verdict?: QaVerdict
  /** Pourquoi l'agent s'est arrêté. */
  readonly message?: string
  /** Rapport de l'agent à sa passe, quand il a fini. */
  readonly report?: string
}

export type ProgressListener = (event: AgentProgress) => void

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
  /** Spec de lot signée par le PO (L1o D25) : son aiguillage et son conseil de rythme. */
  readonly plan?: LotPlan
}

export interface ApprovalResult {
  readonly merged: boolean
  readonly baseBranch: string
  readonly commit?: string
  readonly message?: string
  /** Nombre de cases de tâches cochées par la fusion dans leur fichier (L1o D23, D25). */
  readonly checked?: number
}

/** Rangement après la fusion (L1o D23) : branches d'agents supprimées, et celles gardées (non fusionnées). */
export interface CleanupResult {
  readonly removed: readonly string[]
  readonly kept: readonly string[]
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
