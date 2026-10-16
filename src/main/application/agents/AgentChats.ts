import { randomUUID } from 'node:crypto'
import { AGENT_ROLE_LABELS, type AgentProfileView, type PermissionMode } from '@shared/agents/profile'
import type { AssemblySketchView } from '@shared/ipc/assemblies'
import { AppError } from '../../domain/errors'
import type { HiddenChatKind } from '../../infrastructure/db/repositories/WorkflowChatRepository'
import { workflowHostGenesis } from './workflowHost'

/**
 * Conversation en visio avec un agent connecté à un nœud du Workflow (L1o D13) : une par agent et par nœud, créée au
 * premier appel, reprise ensuite. Elle parle avec la persona du profil (rôle, consignes, modèle), dans le dossier où
 * l'agent travaille (son worktree s'il existe, sinon le projet).
 */

/** Clé de la conversation d'un agent : celle de son nœud sur la carte (`agent:<agent>:<nœud du Workflow>`). */
export const agentChatKey = (hostId: string, agentId: string): string => `agent:${agentId}:${hostId}`

/** Clé de la conversation en tête-à-tête avec un agent, hors de toute tâche (L1o D22). */
export const PROFILE_CHAT_PREFIX = 'agent-profile-chat:'
export const profileChatKey = (profileId: string): string => `${PROFILE_CHAT_PREFIX}${profileId}`

export function parseAgentChatKey(key: string): { readonly hostId: string; readonly agentId: string } | null {
  const [prefix, agentId, ...rest] = key.split(':')
  const hostId = rest.join(':')
  if (prefix !== 'agent' || agentId === undefined || agentId === '' || hostId === '') return null
  return { hostId, agentId }
}

/** Ce qu'une conversation d'agent change à une conversation ordinaire. */
export interface AgentPersona {
  /** Ajouté au cadre de l'app (`--append-system-prompt`). */
  readonly systemPrompt: string
  readonly model: string
  /** Mode de permission par défaut de la conversation (Libre se confirme toujours dans la conversation). */
  readonly permissionMode: PermissionMode
  /** Worktree de l'agent s'il existe ; `null` : le dossier du projet. */
  readonly cwd: string | null
}

/** Persona de la conversation : qui parle, de quelle tâche, avec quelles consignes. Pur. */
export function agentPersona(input: {
  readonly profile: AgentProfileView
  /** Noms des skills que son profil peut consulter. */
  readonly skillNames?: readonly string[]
  /** `null` : tête-à-tête hors de toute tâche (L1o D22). */
  readonly hostTitle: string | null
  readonly hostContext: string
  readonly worktree: string | null
}): AgentPersona {
  const { profile } = input
  const prompt = [
    `Tu es « ${profile.name} », agent ${AGENT_ROLE_LABELS[profile.role]}, en visio avec mentalyas dans le Brainstormer.`,
    input.hostTitle === null
      ? 'Vous faites connaissance, hors de toute tâche : dis qui tu es, ce que tu sais faire et comment tu travailles ; ' +
        'il peut ajuster ta façon de faire et tes skills.'
      : `Vous parlez de la tâche « ${input.hostTitle} », à laquelle tu es connecté.`,
    'Réponds à l’oral, en phrases courtes : tes réponses s’affichent en sous-titres de la visio.',
    input.worktree === null
      ? 'Tu es dans le dossier du projet : ne modifie rien sans qu’on te le demande.'
      : 'Tu es dans ton worktree, sur ta branche d’agent : c’est là que tu as travaillé.',
    profile.instructions.trim() === '' ? '' : `Tes consignes :\n${profile.instructions.trim()}`,
    `Tes skills : ${(input.skillNames ?? []).join(', ') || 'aucun pour l’instant'}. Si mentalyas te demande d’en ajouter ` +
      'ou d’en retirer, lis la toile avec `skills_lire` puis propose le changement avec `agent_skills_proposer` (il ' +
      'accepte ou refuse dans le volet). Pour améliorer le contenu d’un skill, dépose un brouillon avec ' +
      '`skill_brouillon` : il le voit et l’installe depuis le volet.',
    'Pour connaître l’équipe disponible (tes coéquipiers, les profils à recommander), appelle `agents_lire`.',
    input.hostContext.trim() === '' ? '' : `Ce que dit la tâche :\n${input.hostContext.trim()}`
  ]
  return {
    systemPrompt: prompt.filter((part) => part !== '').join('\n\n'),
    model: profile.model,
    // Le mode du profil (L1o D19) ; Libre ne vaut dans la conversation qu'une fois confirmé (ConversationService).
    permissionMode: profile.permissionMode,
    cwd: input.worktree
  }
}

export interface AgentChatsDeps {
  readonly repository: {
    chatOf(genesisId: string, key: string, kind: HiddenChatKind): string | undefined
    insert(input: { id: string; genesisId: string | null; key: string; title: string; kind: HiddenChatKind }): void
  }
  readonly sketches: (genesisId: string) => readonly AssemblySketchView[]
  /** Conversations sans genesis (tête-à-tête, L1o D22) ; absent : pas de tête-à-tête. */
  readonly profileChats?: {
    chatOf(key: string): string | undefined
  }
  readonly profile: (profileId: string) => AgentProfileView | undefined
  /** Genesis lié à un dossier de projet (vivant) ; sinon pas de conversation. */
  readonly linkedGenesis: (genesisId: string) => boolean
  readonly newId?: () => string
}

export class AgentChats {
  constructor(private readonly deps: AgentChatsDeps) {}

  /** Conversation avec l'agent `agentId` du nœud `hostId` : retrouvée, ou créée au premier appel. */
  open(hostId: string, agentId: string): { readonly neuronId: string } {
    const genesisId = workflowHostGenesis(hostId)
    if (genesisId === null || !this.deps.linkedGenesis(genesisId))
      throw new AppError('NOT_FOUND', 'Projet introuvable.')
    const agent = this.deps
      .sketches(genesisId)
      .find((sketch) => sketch.nodeId === hostId)
      ?.agents.find((entry) => entry.id === agentId)
    if (agent === undefined) throw new AppError('NOT_FOUND', 'Cet agent n’est plus connecté à ce nœud.')
    const profile = this.deps.profile(agent.profileId)
    if (profile === undefined) throw new AppError('NOT_FOUND', 'Le profil de cet agent n’existe plus.')
    const key = agentChatKey(hostId, agentId)
    const existing = this.deps.repository.chatOf(genesisId, key, 'agent_chat')
    if (existing !== undefined) return { neuronId: existing }
    const neuronId = (this.deps.newId ?? randomUUID)()
    this.deps.repository.insert({ id: neuronId, genesisId, key, title: profile.name, kind: 'agent_chat' })
    return { neuronId }
  }

  /** Tête-à-tête avec un agent hors de toute tâche (L1o D22) : retrouvé, ou créé au premier appel. */
  openProfile(profileId: string): { readonly neuronId: string } {
    const profile = this.deps.profile(profileId)
    if (profile === undefined) throw new AppError('NOT_FOUND', 'Ce profil d’agent n’existe plus.')
    if (this.deps.profileChats === undefined) throw new AppError('NOT_FOUND', 'Conversation indisponible.')
    const key = profileChatKey(profileId)
    const existing = this.deps.profileChats.chatOf(key)
    if (existing !== undefined) return { neuronId: existing }
    const neuronId = (this.deps.newId ?? randomUUID)()
    this.deps.repository.insert({ id: neuronId, genesisId: null, key, title: profile.name, kind: 'agent_chat' })
    return { neuronId }
  }
}
