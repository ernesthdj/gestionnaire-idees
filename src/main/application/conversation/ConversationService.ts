import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import type {
  ChatDeltaEvent,
  ChatErrorCode,
  ChatErrorEvent,
  ChatMessageView,
  ChatToolEvent,
  ChatTurnEndEvent,
  ChatUsageEvent,
  ChatUsageView,
  ChatView
} from '@shared/ipc/chat'
import { withContext, type NeuronContext } from '../../domain/conversation/contextBlock'
import { readSheet } from '../../domain/conversation/sheet'
import { parseStreamLine, toolLabel, type StreamEvent } from '../../domain/conversation/streamEvents'
import { AppError } from '../../domain/errors'
import type { ConversationProcess, SpawnConversation } from '../../infrastructure/claude/CliConversation'
import type {
  ConversationNeuron,
  ConversationRepository,
  MessageRole
} from '../../infrastructure/db/repositories/ConversationRepository'

export type ChatEvent =
  | { readonly type: 'chat:delta'; readonly payload: ChatDeltaEvent }
  | { readonly type: 'chat:tool'; readonly payload: ChatToolEvent }
  | { readonly type: 'chat:turnEnd'; readonly payload: ChatTurnEndEvent }
  | { readonly type: 'chat:error'; readonly payload: ChatErrorEvent }
  | { readonly type: 'chat:usage'; readonly payload: ChatUsageEvent }

export interface ConversationSettings {
  /** Dossier de travail des conversations sans dossier de projet (`%APPDATA%/<profil>/workspace`). */
  readonly cwd: string
  /** Modèle par défaut des genesis (idées, projets). */
  readonly model: string
  /** Modèle par défaut des éléments d'une carte de structure ; absent : celui des genesis. */
  readonly elementModel?: string
  /** Lancement du relais du pont MCP (spec 007) pour cette conversation. */
  readonly electronPath: string
  readonly relayPath: string
  readonly profileDir: string
}

export interface ConversationDeps {
  readonly repository: Pick<
    ConversationRepository,
    | 'neuron'
    | 'setSession'
    | 'setProjectDir'
    | 'setChatModel'
    | 'messages'
    | 'addMessage'
    | 'maturity'
    | 'recordTurn'
    | 'usageSince'
    | 'saveAccountUsage'
    | 'accountUsage'
  >
  readonly spawn: SpawnConversation
  readonly claudePath: () => Promise<string | undefined>
  readonly settings: () => ConversationSettings
  /** Cadre stable (`--append-system-prompt`). */
  readonly frame: string
  readonly emit: (event: ChatEvent) => void
  /** Sélecteur de dossier natif (main) ; `undefined` si annulé. Jamais un chemin venu de l'interface. */
  readonly pickFolder?: () => Promise<string | undefined>
  readonly folderExists?: (path: string) => boolean
  readonly newSessionId?: () => string
  readonly now?: () => Date
  /** Arrêt d'une conversation inactive (10 min) ; après fermeture du panneau (2 min). */
  readonly idleMs?: number
  readonly closeGraceMs?: number
  readonly maxLive?: number
}

/** Outils autorisés : la carte, la lecture de fichiers du dossier de travail, la recherche web (L1c n°10). */
export const CHAT_BUILTIN_TOOLS = 'Read,Glob,Grep,WebSearch'
export const CHAT_ALLOWED_TOOLS = 'mcp__brainstormer Read Glob Grep WebSearch'

/** Arguments fixes du CLI (spec 008 research R1) : aucun ne vient de l'interface ni du texte de mentalyas. */
export function conversationArgs(input: {
  readonly sessionId: string
  readonly resume: boolean
  readonly neuronId: string
  readonly frame: string
  readonly settings: ConversationSettings
}): string[] {
  const { settings } = input
  const mcpConfig = {
    mcpServers: {
      brainstormer: {
        type: 'stdio',
        command: settings.electronPath,
        args: [settings.relayPath],
        env: { ELECTRON_RUN_AS_NODE: '1', GI_PROFILE_DIR: settings.profileDir, GI_NEURON_ID: input.neuronId }
      }
    }
  }
  return [
    '-p',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    ...(input.resume ? ['--resume', input.sessionId] : ['--session-id', input.sessionId]),
    '--model',
    settings.model,
    // Aucune source de réglages : ni hooks ni réglages de l'utilisateur, ni ceux d'un projet lié (un dépôt non fiable
    // pourrait y cacher des commandes). Vérifié sur 2.1.289 : avec « project », un hook du projet s'exécute ; avec
    // « », rien ne s'exécute — et le CLAUDE.md du projet n'est plus chargé d'office : Claude le lit (Read), comme une donnée.
    '--setting-sources',
    '',
    '--strict-mcp-config',
    '--mcp-config',
    JSON.stringify(mcpConfig),
    '--tools',
    CHAT_BUILTIN_TOOLS,
    '--allowedTools',
    CHAT_ALLOWED_TOOLS,
    '--permission-prompts',
    'none',
    '--append-system-prompt',
    input.frame
  ]
}

interface Live {
  readonly process: ConversationProcess
  readonly sessionId: string
  busy: boolean
  stopping: boolean
  contextSent: boolean
  started: boolean
  partial: string
  model: string
  turnStarted: number
  quotaRejected: { readonly resetsAt: number | null } | null
  timer: ReturnType<typeof setTimeout> | undefined
  lastActive: number
}

const MESSAGES: Readonly<Record<ChatErrorCode, string>> = {
  CLAUDE_NOT_FOUND:
    'Claude Code est introuvable sur cette machine. Installe-le (claude.com/claude-code), connecte-toi avec `claude`, puis réessaie.',
  NOT_LOGGED_IN: 'Claude Code n’est pas connecté : lance `claude` dans un terminal pour te connecter, puis réessaie.',
  LIMIT_REACHED: 'La limite d’usage de ton abonnement est atteinte pour l’instant.',
  PROCESS_FAILED: 'La conversation s’est interrompue de façon inattendue. Renvoie ton message pour reprendre.',
  SESSION_RESET:
    'La conversation précédente n’a pas pu être reprise : une nouvelle commence, avec la fiche du neurone comme contexte.',
  FOLDER_MISSING:
    'Le dossier de projet lié à ce neurone est introuvable (déplacé ou supprimé ?) : relie-le depuis le menu du neurone.'
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Relevé de l'abonnement mémorisé, relu de façon tolérante. */
function readAccount(value: unknown): ChatUsageView['account'] {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const status = record['status']
  if (status !== 'allowed' && status !== 'allowed_warning' && status !== 'rejected') return null
  const windowOf = (raw: unknown) => {
    if (typeof raw !== 'object' || raw === null) return null
    const { utilization, resetsAt } = raw as Record<string, unknown>
    return typeof utilization === 'number'
      ? { utilization, resetsAt: typeof resetsAt === 'number' ? resetsAt : null }
      : null
  }
  return {
    status,
    fiveHour: windowOf(record['fiveHour']),
    sevenDay: windowOf(record['sevenDay']),
    updatedAt: typeof record['updatedAt'] === 'string' ? record['updatedAt'] : ''
  }
}

/**
 * Conversations Claude Code des neurones (spec 008 lot A) : un processus `claude` en flux par conversation ouverte,
 * session reprise d'une ouverture à l'autre, contexte frais joint au premier message, historique et consommation
 * gardés dans la base, flux relayé à l'interface. Un neurone peut être lié à un dossier de projet : sa conversation
 * s'y ouvre. Au plus 3 processus ; arrêt à l'inactivité ; un tour à la fois par conversation.
 */
export class ConversationService {
  private readonly live = new Map<string, Live>()

  constructor(private readonly deps: ConversationDeps) {}

  open(neuronId: string): ChatView {
    const neuron = this.neuronOrThrow(neuronId)
    const live = this.live.get(neuronId)
    if (live !== undefined) this.touch(neuronId, live, this.deps.idleMs ?? 10 * 60_000)
    return {
      neuronId,
      title: neuron.title,
      messages: this.deps.repository.messages(neuronId),
      sheet: readSheet(neuron.sheetJson),
      maturity: this.deps.repository.maturity(neuron.rootId),
      busy: live?.busy ?? false,
      partial: live?.partial ?? '',
      usage: this.usage(neuronId),
      folder: ((dir) => (dir === null ? null : basename(dir)))(this.folderOf(neuron)),
      role: neuron.genesisId === null ? 'genesis' : 'element',
      elementType: neuron.elementType,
      model: this.modelOf(neuron, this.deps.settings()),
      modelChoice: neuron.chatModel
    }
  }

  usage(neuronId: string): ChatUsageView {
    const { repository } = this.deps
    const since = new Date((this.deps.now?.() ?? new Date()).getTime() - WEEK_MS).toISOString()
    const week = repository.usageSince(since)
    const total = repository.usageSince(null)
    const own = repository.usageSince(null, neuronId)
    return {
      account: readAccount(repository.accountUsage()),
      app: {
        weekTokens: week.tokens,
        weekTurns: week.turns,
        totalTokens: total.tokens,
        totalTurns: total.turns,
        neuronTokens: own.tokens,
        neuronTurns: own.turns
      }
    }
  }

  /**
   * Lie le neurone à un dossier de projet choisi dans le sélecteur natif (spec 008) ; `null` délie. La conversation
   * repart sur une nouvelle session (le CLI range ses sessions par dossier) ; la fiche est gardée.
   */
  async linkFolder(neuronId: string, unlink = false): Promise<{ readonly folder: string | null }> {
    const neuron = this.neuronOrThrow(neuronId)
    if (neuron.genesisId !== null) {
      throw new AppError(
        'VALIDATION',
        'Un élément travaille dans le dossier de son projet : lie le dossier sur le genesis.'
      )
    }
    if (this.live.get(neuronId)?.busy === true)
      throw new AppError('BUSY', 'Claude répond encore : attends la fin du tour.')
    let folder: string | null = null
    if (!unlink) {
      const picked = await this.deps.pickFolder?.()
      if (picked === undefined) return { folder: neuron.projectDir === null ? null : basename(neuron.projectDir) }
      folder = picked
    }
    this.dispose(neuronId)
    this.deps.repository.setProjectDir(neuronId, folder, this.deps.newSessionId?.() ?? randomUUID())
    return { folder: folder === null ? null : basename(folder) }
  }

  async send(neuronId: string, text: string): Promise<void> {
    const neuron = this.neuronOrThrow(neuronId)
    if (this.live.get(neuronId)?.busy === true)
      throw new AppError('BUSY', 'Claude répond encore : attends la fin du tour.')
    const live = this.live.get(neuronId) ?? (await this.start(neuron))
    if (live === undefined) return
    const content = live.contextSent ? text : withContext(this.contextOf(neuron, live), text)
    live.contextSent = true
    live.busy = true
    live.stopping = false
    live.partial = ''
    live.quotaRejected = null
    live.turnStarted = Date.now()
    this.deps.repository.addMessage(neuronId, 'user', text)
    this.touch(neuronId, live, this.deps.idleMs ?? 10 * 60_000)
    live.process.write(JSON.stringify({ type: 'user', message: { role: 'user', content } }))
  }

  /**
   * Modèle de cette conversation (spec 010) ; `null` revient au défaut de son usage. Le processus est arrêté : l'échange
   * suivant reprend la même session avec le nouveau modèle.
   */
  setModel(neuronId: string, model: string | null): ChatView {
    this.neuronOrThrow(neuronId)
    if (this.live.get(neuronId)?.busy === true)
      throw new AppError('BUSY', 'Claude répond encore : attends la fin du tour.')
    this.deps.repository.setChatModel(neuronId, model)
    this.dispose(neuronId)
    return this.open(neuronId)
  }

  /** Interrompt le tour en cours : ce qui a été reçu est gardé ; la session reprendra au message suivant. */
  stop(neuronId: string): void {
    const live = this.live.get(neuronId)
    if (live === undefined || !live.busy) return
    live.stopping = true
    live.process.kill()
  }

  /** Panneau fermé : la conversation reste prête quelques minutes, puis son processus s'arrête. */
  close(neuronId: string): void {
    const live = this.live.get(neuronId)
    if (live !== undefined && !live.busy) this.touch(neuronId, live, this.deps.closeGraceMs ?? 2 * 60_000)
  }

  stopAll(): void {
    for (const [neuronId, live] of this.live) {
      clearTimeout(live.timer)
      live.process.kill()
      this.live.delete(neuronId)
    }
  }

  liveCount(): number {
    return this.live.size
  }

  private async start(neuron: ConversationNeuron): Promise<Live | undefined> {
    const command = await this.deps.claudePath()
    if (command === undefined) {
      this.fail(neuron.id, 'CLAUDE_NOT_FOUND', null)
      return undefined
    }
    const settings = this.deps.settings()
    const exists = this.deps.folderExists ?? existsSync
    const folder = this.folderOf(neuron)
    if (folder !== null && !exists(folder)) {
      this.fail(neuron.id, 'FOLDER_MISSING', null)
      return undefined
    }
    this.makeRoom()
    let sessionId = neuron.sessionId
    if (sessionId === null) {
      sessionId = this.deps.newSessionId?.() ?? randomUUID()
      this.deps.repository.setSession(neuron.id, sessionId, false)
    }
    const resume = neuron.sessionStarted
    const model = this.modelOf(neuron, settings)
    const args = conversationArgs({
      sessionId,
      resume,
      neuronId: neuron.id,
      frame: this.deps.frame,
      settings: { ...settings, model }
    })
    const neuronId = neuron.id
    const process = this.deps.spawn({
      command,
      args,
      cwd: folder ?? settings.cwd,
      onLine: (line) => {
        for (const event of parseStreamLine(line)) this.onEvent(neuronId, event)
      },
      onExit: (_code, stderr) => this.onExit(neuronId, stderr)
    })
    const live: Live = {
      process,
      sessionId,
      busy: false,
      stopping: false,
      contextSent: false,
      started: resume,
      partial: '',
      model,
      turnStarted: Date.now(),
      quotaRejected: null,
      timer: undefined,
      lastActive: Date.now()
    }
    this.live.set(neuronId, live)
    return live
  }

  /** Au plus `maxLive` processus : la conversation inactive la plus ancienne est arrêtée. */
  private makeRoom(): void {
    const max = this.deps.maxLive ?? 3
    if (this.live.size < max) return
    const idle = [...this.live.entries()]
      .filter(([, live]) => !live.busy)
      .sort(([, a], [, b]) => a.lastActive - b.lastActive)[0]
    if (idle === undefined)
      throw new AppError('BUSY', 'Trop de conversations en cours : attends qu’une réponse se termine.')
    this.dispose(idle[0])
  }

  private onEvent(neuronId: string, event: StreamEvent): void {
    const live = this.live.get(neuronId)
    if (live === undefined) return
    switch (event.kind) {
      case 'init':
        if (event.model !== '') live.model = event.model
        return
      case 'delta':
        live.partial += event.text
        this.deps.emit({ type: 'chat:delta', payload: { neuronId, text: event.text } })
        return
      case 'tool': {
        const message = this.save(neuronId, 'tool', toolLabel(event.name))
        this.deps.emit({ type: 'chat:tool', payload: { neuronId, message } })
        return
      }
      case 'quota':
        if (event.status === 'rejected') live.quotaRejected = { resetsAt: event.resetsAt }
        this.deps.repository.saveAccountUsage({
          status: event.status,
          fiveHour: event.fiveHour,
          sevenDay: event.sevenDay,
          updatedAt: (this.deps.now?.() ?? new Date()).toISOString()
        })
        this.emitUsage(neuronId)
        return
      case 'result': {
        live.busy = false
        this.touch(neuronId, live, this.deps.idleMs ?? 10 * 60_000)
        this.deps.repository.recordTurn(neuronId, {
          model: live.model,
          ok: event.ok,
          durationMs: Date.now() - live.turnStarted,
          ...event.usage
        })
        this.emitUsage(neuronId)
        if (!event.ok) {
          if (live.quotaRejected !== null) this.fail(neuronId, 'LIMIT_REACHED', live.quotaRejected.resetsAt)
          else this.fail(neuronId, 'PROCESS_FAILED', null)
          return
        }
        if (!live.started) {
          live.started = true
          this.deps.repository.setSession(neuronId, live.sessionId, true)
        }
        const text = (event.text === '' ? live.partial : event.text).trim()
        live.partial = ''
        const message = text === '' ? null : this.save(neuronId, 'assistant', text)
        this.deps.emit({ type: 'chat:turnEnd', payload: { neuronId, message, interrupted: false } })
      }
    }
  }

  private emitUsage(neuronId: string): void {
    this.deps.emit({ type: 'chat:usage', payload: { neuronId, usage: this.usage(neuronId) } })
  }

  private onExit(neuronId: string, stderr: string): void {
    const live = this.live.get(neuronId)
    if (live === undefined) return
    clearTimeout(live.timer)
    this.live.delete(neuronId)
    if (live.stopping) {
      const text = live.partial.trim()
      const message = text === '' ? null : this.save(neuronId, 'assistant', `${text}\n\n(réponse interrompue)`)
      this.deps.emit({ type: 'chat:turnEnd', payload: { neuronId, message, interrupted: true } })
      return
    }
    if (!live.busy) return
    if (/no conversation found|session.*not found/i.test(stderr)) {
      // Transcription introuvable : une nouvelle session, et le contexte sera rejoint.
      this.deps.repository.setSession(neuronId, this.deps.newSessionId?.() ?? randomUUID(), false)
      this.fail(neuronId, 'SESSION_RESET', null)
      return
    }
    if (/not logged in|log in|login|authenticat/i.test(stderr)) {
      this.fail(neuronId, 'NOT_LOGGED_IN', null)
      return
    }
    this.fail(neuronId, 'PROCESS_FAILED', null)
  }

  private fail(neuronId: string, code: ChatErrorCode, resetsAt: number | null): void {
    const when = resetsAt === null ? '' : ` Reprise vers ${new Date(resetsAt * 1000).toLocaleString('fr-BE')}.`
    const message = this.save(neuronId, 'error', `${MESSAGES[code]}${when}`)
    this.deps.emit({ type: 'chat:error', payload: { neuronId, code, message, resetsAt } })
  }

  private save(neuronId: string, role: MessageRole, text: string): ChatMessageView {
    return this.deps.repository.addMessage(neuronId, role, text)
  }

  private contextOf(neuron: ConversationNeuron, live: Live): NeuronContext {
    const folder = this.folderOf(neuron)
    const base = {
      id: neuron.id,
      title: neuron.title,
      content: neuron.content,
      sheet: readSheet(neuron.sheetJson),
      maturity: this.deps.repository.maturity(neuron.rootId),
      resumed: live.started,
      folder: folder === null ? null : basename(folder)
    }
    if (neuron.genesisId === null) return base
    // Élément d'une carte de structure (spec 009) : son type, ses fichiers, son chemin d'ancêtres, la fiche du projet.
    const genesis = this.deps.repository.neuron(neuron.genesisId)
    const chain: string[] = []
    let parentId = neuron.parentId
    for (let guard = 0; parentId !== null && parentId !== neuron.genesisId && guard < 50; guard++) {
      const parent = this.deps.repository.neuron(parentId)
      if (parent === undefined) break
      chain.unshift(`${parent.elementType ?? 'élément'} « ${parent.title} »`)
      parentId = parent.parentId
    }
    let paths: string[] = []
    try {
      const value: unknown = JSON.parse(neuron.pathsJson ?? '[]')
      if (Array.isArray(value)) paths = value.filter((item): item is string => typeof item === 'string')
    } catch {
      paths = []
    }
    return {
      ...base,
      element: {
        type: neuron.elementType ?? 'élément',
        paths,
        chain,
        projectTitle: genesis?.title ?? 'projet',
        projectSheet: readSheet(genesis?.sheetJson ?? null)
      }
    }
  }

  /** Modèle d'une conversation : celui choisi, sinon le défaut de son usage (genesis ou élément). */
  private modelOf(neuron: ConversationNeuron, settings: ConversationSettings): string {
    if (neuron.chatModel !== null) return neuron.chatModel
    return neuron.genesisId === null ? settings.model : (settings.elementModel ?? settings.model)
  }

  /** Dossier de travail d'un neurone : le sien, ou celui du projet de son genesis (élément de structure). */
  private folderOf(neuron: ConversationNeuron): string | null {
    if (neuron.projectDir !== null) return neuron.projectDir
    if (neuron.genesisId === null) return null
    return this.deps.repository.neuron(neuron.genesisId)?.projectDir ?? null
  }

  private touch(neuronId: string, live: Live, delay: number): void {
    live.lastActive = Date.now()
    clearTimeout(live.timer)
    live.timer = setTimeout(() => {
      if (!live.busy) this.dispose(neuronId)
    }, delay)
  }

  private dispose(neuronId: string): void {
    const live = this.live.get(neuronId)
    if (live === undefined) return
    clearTimeout(live.timer)
    this.live.delete(neuronId)
    live.process.kill()
  }

  private neuronOrThrow(neuronId: string): ConversationNeuron {
    const neuron = this.deps.repository.neuron(neuronId)
    if (neuron === undefined || neuron.state === 'archived') throw new AppError('NOT_FOUND', 'Neurone introuvable')
    return neuron
  }
}
