import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHAT_ALLOWED_TOOLS,
  ConversationService,
  type ChatEvent,
  type ConversationDeps
} from '../../../src/main/application/conversation/ConversationService'
import type { SpawnOptions } from '../../../src/main/infrastructure/claude/CliConversation'
import type {
  ConversationNeuron,
  MessageRole,
  MessageRow,
  TurnRecord
} from '../../../src/main/infrastructure/db/repositories/ConversationRepository'

const N1 = '00000000-0000-4000-8000-0000000000c1'
const N2 = '00000000-0000-4000-8000-0000000000c2'
const N3 = '00000000-0000-4000-8000-0000000000c3'
const N4 = '00000000-0000-4000-8000-0000000000c4'

interface FakeProcess {
  readonly options: SpawnOptions
  readonly written: string[]
  killed: boolean
  emit(value: unknown): void
  exit(stderr?: string): void
}

describe('conversations Claude Code des neurones', () => {
  let neurons: Map<string, ConversationNeuron>
  let messages: { neuronId: string; role: MessageRole; text: string }[]
  let processes: FakeProcess[]
  let events: ChatEvent[]
  let service: ConversationService
  let claudePath: string | undefined
  let sessions: number
  let turns: ({ neuronId: string } & TurnRecord)[]
  let account: unknown
  let picked: string | undefined

  const neuron = (id: string, extra: Partial<ConversationNeuron> = {}): ConversationNeuron => ({
    id,
    rootId: id,
    kind: 'root',
    title: `Idée ${id.slice(-2)}`,
    content: null,
    state: 'raw',
    absorbed: false,
    sessionId: null,
    sessionStarted: false,
    sheetJson: JSON.stringify({
      resume: '',
      points_cles: [],
      decisions: ['Lieu : Liège'],
      questions_ouvertes: [],
      manques: []
    }),
    projectDir: null,
    genesisId: null,
    elementType: null,
    pathsJson: null,
    parentId: null,
    chatModel: null,
    ...extra
  })

  const build = (extra: Partial<ConversationDeps> = {}): ConversationService =>
    new ConversationService({
      repository: {
        neuron: (id) => neurons.get(id),
        setSession: (id, sessionId, started) => {
          const current = neurons.get(id)
          if (current !== undefined) neurons.set(id, { ...current, sessionId, sessionStarted: started })
        },
        messages: (id) =>
          messages
            .filter((message) => message.neuronId === id)
            .map((message, index): MessageRow => ({
              id: String(index),
              role: message.role,
              text: message.text,
              createdAt: ''
            })),
        addMessage: (neuronId, role, text) => {
          messages.push({ neuronId, role, text })
          return { id: String(messages.length), role, text, createdAt: '' }
        },
        maturity: () => null,
        setProjectDir: (id, projectDir, sessionId) => {
          const current = neurons.get(id)
          if (current !== undefined) neurons.set(id, { ...current, projectDir, sessionId, sessionStarted: false })
        },
        setChatModel: (id, chatModel) => {
          const current = neurons.get(id)
          if (current !== undefined) neurons.set(id, { ...current, chatModel })
        },
        recordTurn: (neuronId, turn) => turns.push({ neuronId, ...turn }),
        usageSince: (_since, neuronId) => {
          const mine = turns.filter((turn) => neuronId === undefined || turn.neuronId === neuronId)
          return {
            tokens: mine.reduce(
              (sum, turn) => sum + turn.inputTokens + turn.outputTokens + turn.cacheReadTokens + turn.cacheWriteTokens,
              0
            ),
            turns: mine.length
          }
        },
        saveAccountUsage: (value) => {
          account = value
        },
        accountUsage: () => account
      },
      spawn: (options) => {
        const process: FakeProcess = {
          options,
          written: [],
          killed: false,
          emit: (value) => options.onLine(JSON.stringify(value)),
          exit: (stderr = '') => options.onExit(1, stderr)
        }
        processes.push(process)
        return {
          write: (line) => process.written.push(line),
          kill: () => {
            process.killed = true
            options.onExit(null, '')
          }
        }
      },
      claudePath: async () => claudePath,
      settings: () => ({
        cwd: 'C:\\ws',
        model: 'claude-sonnet-5-5',
        elementModel: 'claude-haiku-4-5',
        electronPath: 'C:\\e.exe',
        relayPath: 'C:\\relay.js',
        profileDir: 'C:\\profil'
      }),
      frame: 'CADRE',
      emit: (event) => events.push(event),
      pickFolder: async () => picked,
      folderExists: (path) => path !== 'C:/disparu',
      newSessionId: () => `5e55${String(++sessions).padStart(4, '0')}-0000-4000-8000-000000000000`,
      ...extra
    })

  const sent = (process: FakeProcess, index = 0): string =>
    (JSON.parse(process.written[index] ?? '{}') as { message: { content: string } }).message.content
  const finish = (process: FakeProcess, text: string): void => {
    process.emit({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } })
    process.emit({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: text,
      session_id: 's',
      usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 100, cache_creation_input_tokens: 5 }
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    neurons = new Map([
      [N1, neuron(N1)],
      [N2, neuron(N2)],
      [N3, neuron(N3)],
      [N4, neuron(N4)]
    ])
    messages = []
    processes = []
    events = []
    claudePath = 'C:\\claude.exe'
    sessions = 0
    turns = []
    account = null
    picked = undefined
    service = build()
  })
  afterEach(() => vi.useRealTimers())

  it('should_launch_claude_with_fixed_restricted_arguments_and_a_new_session', async () => {
    await service.send(N1, 'Salut')
    const { options } = processes[0] as FakeProcess
    expect(options.command).toBe('C:\\claude.exe')
    expect(options.cwd).toBe('C:\\ws')
    const args = options.args
    expect(args).toEqual(expect.arrayContaining(['-p', '--input-format', 'stream-json', '--setting-sources', '']))
    expect(args[args.indexOf('--session-id') + 1]).toBe(neurons.get(N1)?.sessionId)
    expect(args).not.toContain('--resume')
    expect(args[args.indexOf('--allowedTools') + 1]).toBe(CHAT_ALLOWED_TOOLS)
    expect(args[args.indexOf('--permission-prompts') + 1]).toBe('none')
    expect(args).not.toContain('Salut')
    const mcp = JSON.parse(args[args.indexOf('--mcp-config') + 1] ?? '{}') as {
      mcpServers: { brainstormer: { env: Record<string, string> } }
    }
    expect(mcp.mcpServers.brainstormer.env).toMatchObject({ GI_NEURON_ID: N1, ELECTRON_RUN_AS_NODE: '1' })
  })

  it('should_join_the_context_only_to_the_first_message_of_a_process', async () => {
    await service.send(N1, 'Premier')
    const process = processes[0] as FakeProcess
    expect(sent(process)).toContain('<contexte_brainstormer>')
    expect(sent(process)).toContain('Lieu : Liège')
    expect(sent(process)).toMatch(/Premier$/)
    finish(process, 'Bonjour !')
    await service.send(N1, 'Deuxième')
    expect(sent(process, 1)).toBe('Deuxième')
    expect(messages.filter((message) => message.role === 'user').map((message) => message.text)).toEqual([
      'Premier',
      'Deuxième'
    ])
  })

  it('should_resume_the_session_after_a_first_successful_turn', async () => {
    await service.send(N1, 'Salut')
    finish(processes[0] as FakeProcess, 'Bonjour')
    expect(neurons.get(N1)?.sessionStarted).toBe(true)
    service.stopAll()
    await service.send(N1, 'Je reviens')
    const args = (processes[1] as FakeProcess).options.args
    expect(args[args.indexOf('--resume') + 1]).toBe(neurons.get(N1)?.sessionId)
    expect(sent(processes[1] as FakeProcess)).toContain('Reprise d’une conversation existante')
  })

  it('should_relay_deltas_tools_and_save_the_full_answer', async () => {
    await service.send(N1, 'Salut')
    const process = processes[0] as FakeProcess
    process.emit({
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Bon' } }
    })
    process.emit({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'mcp__brainstormer__fiche_ecrire', input: {} }] }
    })
    process.emit({ type: 'result', subtype: 'success', is_error: false, result: 'Bonjour.', session_id: 's' })
    expect(events.map((event) => event.type)).toEqual(['chat:delta', 'chat:tool', 'chat:usage', 'chat:turnEnd'])
    expect(messages.map((message) => [message.role, message.text])).toEqual([
      ['user', 'Salut'],
      ['tool', 'fiche mise à jour'],
      ['assistant', 'Bonjour.']
    ])
  })

  it('should_refuse_a_second_message_during_a_turn', async () => {
    await service.send(N1, 'Salut')
    await expect(service.send(N1, 'Encore')).rejects.toMatchObject({ code: 'BUSY' })
    expect(service.open(N1).busy).toBe(true)
  })

  it('should_keep_the_partial_answer_when_stopped', async () => {
    await service.send(N1, 'Salut')
    const process = processes[0] as FakeProcess
    process.emit({
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Je pen' } }
    })
    service.stop(N1)
    expect(process.killed).toBe(true)
    expect(events.at(-1)).toMatchObject({ type: 'chat:turnEnd', payload: { interrupted: true } })
    expect(messages.at(-1)?.text).toContain('Je pen')
    expect(service.liveCount()).toBe(0)
  })

  it('should_keep_at_most_three_processes_closing_the_oldest_idle_one', async () => {
    for (const id of [N1, N2, N3]) {
      await service.send(id, 'Salut')
      finish(processes.at(-1) as FakeProcess, 'ok')
      vi.advanceTimersByTime(10)
    }
    await service.send(N4, 'Salut')
    expect(service.liveCount()).toBe(3)
    expect((processes[0] as FakeProcess).killed).toBe(true)
  })

  it('should_stop_an_idle_conversation_after_ten_minutes', async () => {
    await service.send(N1, 'Salut')
    finish(processes[0] as FakeProcess, 'ok')
    vi.advanceTimersByTime(10 * 60_000 + 1)
    expect(service.liveCount()).toBe(0)
  })

  it('should_explain_when_claude_is_missing_or_not_logged_in', async () => {
    claudePath = undefined
    await service.send(N1, 'Salut')
    expect(events.at(-1)).toMatchObject({ type: 'chat:error', payload: { code: 'CLAUDE_NOT_FOUND' } })
    claudePath = 'C:\\claude.exe'
    await service.send(N2, 'Salut')
    ;(processes[0] as FakeProcess).exit('Error: not logged in. Please run /login')
    expect(events.at(-1)).toMatchObject({ type: 'chat:error', payload: { code: 'NOT_LOGGED_IN' } })
  })

  it('should_report_the_usage_limit_with_its_reset_time', async () => {
    await service.send(N1, 'Salut')
    const process = processes[0] as FakeProcess
    process.emit({
      type: 'rate_limit_event',
      rate_limit_info: { status: 'rejected', utilization: 1, resetsAt: 1791165600 }
    })
    process.emit({ type: 'result', subtype: 'error_during_execution', is_error: true })
    expect(events.at(-1)).toMatchObject({
      type: 'chat:error',
      payload: { code: 'LIMIT_REACHED', resetsAt: 1791165600 }
    })
  })

  it('should_start_a_new_session_when_the_old_one_cannot_be_resumed', async () => {
    neurons.set(N1, neuron(N1, { sessionId: '5e550000-0000-4000-8000-000000000009', sessionStarted: true }))
    await service.send(N1, 'Salut')
    ;(processes[0] as FakeProcess).exit('No conversation found with session ID')
    expect(events.at(-1)).toMatchObject({ type: 'chat:error', payload: { code: 'SESSION_RESET' } })
    expect(neurons.get(N1)).toMatchObject({ sessionStarted: false })
    expect(neurons.get(N1)?.sessionId).not.toBe('5e550000-0000-4000-8000-000000000009')
  })

  it('should_record_tokens_per_turn_and_keep_the_last_subscription_reading', async () => {
    await service.send(N1, 'Salut')
    const process = processes[0] as FakeProcess
    process.emit({ type: 'system', subtype: 'init', session_id: 's', model: 'claude-opus-5-5', apiKeySource: 'none' })
    process.emit({
      type: 'rate_limit_event',
      rate_limit_info: {
        status: 'allowed_warning',
        utilization: 0.89,
        resetsAt: 2,
        unifiedWindows: { five_hour: { utilization: 0.37, resetsAt: 1 }, seven_day: { utilization: 0.89, resetsAt: 2 } }
      }
    })
    finish(process, 'Bonjour')
    expect(turns).toEqual([
      expect.objectContaining({ neuronId: N1, model: 'claude-opus-5-5', ok: true, inputTokens: 10, outputTokens: 20 })
    ])
    const usage = service.open(N1).usage
    expect(usage.account).toMatchObject({
      status: 'allowed_warning',
      fiveHour: { utilization: 0.37, resetsAt: 1 },
      sevenDay: { utilization: 0.89, resetsAt: 2 }
    })
    expect(usage.app).toMatchObject({
      weekTokens: 135,
      weekTurns: 1,
      totalTokens: 135,
      neuronTokens: 135,
      neuronTurns: 1
    })
    expect(events.filter((event) => event.type === 'chat:usage').length).toBeGreaterThanOrEqual(2)
  })

  it('should_open_the_conversation_in_the_linked_project_folder_with_a_new_session', async () => {
    await service.send(N1, 'Salut')
    finish(processes[0] as FakeProcess, 'ok')
    const before = neurons.get(N1)?.sessionId
    picked = 'C:/projets/brainstormer'
    expect(await service.linkFolder(N1)).toEqual({ folder: 'brainstormer' })
    expect(neurons.get(N1)).toMatchObject({ projectDir: 'C:/projets/brainstormer', sessionStarted: false })
    expect(neurons.get(N1)?.sessionId).not.toBe(before)
    expect(service.open(N1).folder).toBe('brainstormer')
    await service.send(N1, 'On reprend')
    const process = processes[1] as FakeProcess
    expect(process.options.cwd).toBe('C:/projets/brainstormer')
    expect(process.options.args).toContain('--session-id')
    expect(sent(process)).toContain('Dossier de projet lié : « brainstormer »')
  })

  it('should_keep_the_folder_when_the_picker_is_cancelled_and_unlink_on_request', async () => {
    neurons.set(N1, neuron(N1, { projectDir: 'C:/projets/brainstormer' }))
    picked = undefined
    expect(await service.linkFolder(N1)).toEqual({ folder: 'brainstormer' })
    expect(neurons.get(N1)?.projectDir).toBe('C:/projets/brainstormer')
    expect(await service.linkFolder(N1, true)).toEqual({ folder: null })
    expect(neurons.get(N1)?.projectDir).toBeNull()
  })

  it('should_explain_when_the_linked_folder_has_disappeared', async () => {
    neurons.set(N1, neuron(N1, { projectDir: 'C:/disparu' }))
    await service.send(N1, 'Salut')
    expect(processes).toHaveLength(0)
    expect(events.at(-1)).toMatchObject({ type: 'chat:error', payload: { code: 'FOLDER_MISSING' } })
  })

  it('should_use_the_model_of_its_use_and_switch_when_a_model_is_chosen_for_the_conversation', async () => {
    neurons.set(N2, neuron(N2, { genesisId: N1, elementType: 'composant', parentId: N1 }))
    await service.send(N1, 'Genesis')
    const genesisArgs = (processes[0] as FakeProcess).options.args
    expect(genesisArgs[genesisArgs.indexOf('--model') + 1]).toBe('claude-sonnet-5-5')
    await service.send(N2, 'Élément')
    const elementArgs = (processes[1] as FakeProcess).options.args
    expect(elementArgs[elementArgs.indexOf('--model') + 1]).toBe('claude-haiku-4-5')
    finish(processes[0] as FakeProcess, 'ok')
    const view = service.setModel(N1, 'claude-opus-5-5')
    expect(view).toMatchObject({ model: 'claude-opus-5-5', modelChoice: 'claude-opus-5-5' })
    expect((processes[0] as FakeProcess).killed).toBe(true)
    await service.send(N1, 'Suite')
    const args = (processes[2] as FakeProcess).options.args
    expect(args[args.indexOf('--model') + 1]).toBe('claude-opus-5-5')
    expect(args).toContain('--resume')
    expect(() => service.setModel(N2, null)).toThrow(/répond encore/)
  })
})
