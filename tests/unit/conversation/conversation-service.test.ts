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
    rank: null,
    lockedAt: null,
    chatPermissionMode: null,
    chatExtraDirsJson: null,
    chatBypassConfirmedAt: null,
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
              createdAt: '',
              toolUseId: null,
              toolStatus: null,
              toolReason: null
            })),
        addMessage: (neuronId, role, text, toolUseId = null) => {
          messages.push({ neuronId, role, text })
          return {
            id: String(messages.length),
            role,
            text,
            createdAt: '',
            toolUseId,
            toolStatus: toolUseId === null ? null : 'running',
            toolReason: null
          }
        },
        setToolStatus: (_neuronId, toolUseId, toolStatus, toolReason) => ({
          id: toolUseId,
          role: 'tool',
          text: 'outil',
          createdAt: '',
          toolUseId,
          toolStatus,
          toolReason
        }),
        maturity: () => null,
        setProjectDir: (id, projectDir, sessionId) => {
          const current = neurons.get(id)
          if (current !== undefined) neurons.set(id, { ...current, projectDir, sessionId, sessionStarted: false })
        },
        setChatModel: (id, chatModel) => {
          const current = neurons.get(id)
          if (current !== undefined) neurons.set(id, { ...current, chatModel })
        },
        setPermissionMode: (id, chatPermissionMode) => {
          const current = neurons.get(id)
          if (current !== undefined) neurons.set(id, { ...current, chatPermissionMode })
        },
        confirmBypass: (id, at) => {
          const current = neurons.get(id)
          if (current !== undefined) neurons.set(id, { ...current, chatBypassConfirmedAt: at })
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

  it('should_launch_claude_with_fixed_arguments_asking_mentalyas_and_a_new_session', async () => {
    await service.send(N1, 'Salut')
    const { options } = processes[0] as FakeProcess
    expect(options.command).toBe('C:\\claude.exe')
    expect(options.cwd).toBe('C:\\ws')
    const args = options.args
    expect(args).toEqual(expect.arrayContaining(['-p', '--input-format', 'stream-json', '--setting-sources', '']))
    expect(args[args.indexOf('--session-id') + 1]).toBe(neurons.get(N1)?.sessionId)
    expect(args).not.toContain('--resume')
    expect(args[args.indexOf('--allowedTools') + 1]).toBe(CHAT_ALLOWED_TOOLS)
    // Spec 014 : outils natifs, demandes relayées à mentalyas, mode Demander par défaut.
    expect(args[args.indexOf('--tools') + 1]).toBe('default')
    expect(args[args.indexOf('--permission-prompt-tool') + 1]).toBe('mcp__brainstormer__permission_demander')
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('default')
    expect(args).not.toContain('--permission-prompts')
    expect(args).not.toContain('--allow-dangerously-skip-permissions')
    expect(args).not.toContain('Salut')
    const mcp = JSON.parse(args[args.indexOf('--mcp-config') + 1] ?? '{}') as {
      mcpServers: { brainstormer: { env: Record<string, string> } }
    }
    expect(mcp.mcpServers.brainstormer.env).toMatchObject({ GI_NEURON_ID: N1, ELECTRON_RUN_AS_NODE: '1' })
    // Spec 014 R5 : le seul réglage chargé est le hook avant écriture de l'app, pour ce neurone.
    const hook = args[args.indexOf('--settings') + 1] ?? ''
    expect(hook).toContain(`--hook ${N1}`)
    expect(hook).toContain('ELECTRON_RUN_AS_NODE=1')
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

  it('should_show_the_real_outcome_of_each_tool_and_cancel_permissions_when_the_chat_closes', async () => {
    const cancelled: string[] = []
    const results: [string, boolean][] = []
    service = build({
      permissions: {
        cancel: (neuronId) => void cancelled.push(neuronId),
        open: () => [],
        modeChanged: () => undefined
      },
      onToolResult: (_neuronId, toolUseId, ok) => void results.push([toolUseId, ok])
    })
    await service.send(N1, 'Corrige et teste')
    const process = processes[0] as FakeProcess
    process.emit({
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: 'C:\\p\\a.ts' } },
          { type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'npm test' } },
          { type: 'tool_use', id: 't3', name: 'Bash', input: { command: 'npm install' } }
        ]
      }
    })
    process.emit({ type: 'system', subtype: 'permission_denied', tool_use_id: 't3', message: 'refusé' })
    process.emit({
      type: 'user',
      message: {
        content: [
          { type: 'tool_result', tool_use_id: 't1', content: 'ok' },
          { type: 'tool_result', tool_use_id: 't2', is_error: true, content: 'Exit code 1' },
          { type: 'tool_result', tool_use_id: 't3', is_error: true, content: 'refusé' }
        ]
      }
    })
    expect(messages.filter((message) => message.role === 'tool').map((message) => message.text)).toEqual([
      'fichier modifié : a.ts',
      'commande : npm test',
      'commande : npm install'
    ])
    const outcomes = events
      .filter((event) => event.type === 'chat:tool')
      .map((event) => (event.type === 'chat:tool' ? event.payload.message.toolStatus : undefined))
    expect(outcomes).toEqual(['running', 'running', 'running', 'ok', 'error', 'denied'])
    // Le livrable d'une action finale ne retient que les écritures réussies (spec 014 R5).
    expect(results).toEqual([
      ['t1', true],
      ['t2', false],
      ['t3', false]
    ])
    service.close(N1)
    expect(cancelled).toEqual([N1])
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

  it('should_open_a_step_with_the_sheets_of_its_path_and_the_model_of_the_elements', async () => {
    neurons.set(N2, neuron(N2, { kind: 'step', title: 'Choisir le lieu', genesisId: N1, parentId: N1, rank: 2 }))
    neurons.set(
      N3,
      neuron(N3, { kind: 'step', title: 'Visiter trois locaux', genesisId: N1, parentId: N2, rank: 1, lockedAt: 'x' })
    )
    expect(service.open(N3)).toMatchObject({ role: 'step', stepLabel: '②.1' })
    await service.send(N3, 'On commence ?')
    const process = processes[0] as FakeProcess
    expect(process.options.args[process.options.args.indexOf('--model') + 1]).toBe('claude-haiku-4-5')
    const context = sent(process)
    expect(context).toContain('étape ②.1 « Visiter trois locaux »')
    expect(context).toContain(`Chemin : Idée c1 › ② Choisir le lieu › ②.1 Visiter trois locaux.`)
    expect(context).toContain('Fiche de l’étape ② « Choisir le lieu »')
    expect(context).toContain('Nœud VERROUILLÉ')
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

  it('should_start_in_the_default_mode_set_in_settings_when_the_conversation_has_none', async () => {
    service = build({ defaultPermissionMode: () => 'acceptEdits' })
    expect(service.open(N1).permissionMode).toBe('acceptEdits')
    await service.send(N1, 'Salut')
    const args = (processes[0] as FakeProcess).options.args
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('acceptEdits')
    expect(args).not.toContain('--allow-dangerously-skip-permissions')
  })

  it('should_require_confirming_the_warning_once_per_conversation_when_switching_to_libre', async () => {
    const modes: [string, string][] = []
    service = build({
      permissions: { cancel: () => undefined, open: () => [], modeChanged: (id, mode) => void modes.push([id, mode]) }
    })
    expect(() => service.setPermissionMode(N1, 'bypassPermissions')).toThrow(
      expect.objectContaining({ code: 'CONFIRM_REQUIRED' })
    )
    expect(neurons.get(N1)?.chatPermissionMode).toBeNull()
    expect(service.setPermissionMode(N1, 'bypassPermissions', true)).toEqual({ mode: 'bypassPermissions' })
    expect(neurons.get(N1)?.chatBypassConfirmedAt).not.toBeNull()
    service.setPermissionMode(N1, 'default')
    // Déjà confirmé pour cette conversation : plus d'avertissement ; une autre conversation le redemande.
    expect(service.setPermissionMode(N1, 'bypassPermissions')).toEqual({ mode: 'bypassPermissions' })
    expect(() => service.setPermissionMode(N2, 'bypassPermissions')).toThrow(/mode Libre/)
    expect(modes).toEqual([
      [N1, 'bypassPermissions'],
      [N1, 'default'],
      [N1, 'bypassPermissions']
    ])
    await service.send(N1, 'Vas-y')
    const args = (processes[0] as FakeProcess).options.args
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('bypassPermissions')
    expect(args).toContain('--allow-dangerously-skip-permissions')
    expect(service.open(N1).permissionMode).toBe('bypassPermissions')
  })

  it('should_apply_a_mode_change_made_during_a_turn_at_the_next_message', async () => {
    await service.send(N1, 'Salut')
    const first = processes[0] as FakeProcess
    expect(service.setPermissionMode(N1, 'acceptEdits')).toEqual({ mode: 'acceptEdits' })
    expect(first.killed).toBe(false)
    expect(service.open(N1)).toMatchObject({ busy: true, permissionMode: 'acceptEdits' })
    finish(first, 'Bonjour')
    expect(first.killed).toBe(true)
    expect(events.at(-1)).toMatchObject({ type: 'chat:turnEnd', payload: { interrupted: false } })
    await service.send(N1, 'Suite')
    const args = (processes[1] as FakeProcess).options.args
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('acceptEdits')
    expect(args).toContain('--resume')
  })

  it('should_restart_an_idle_conversation_right_away_when_its_mode_changes', async () => {
    await service.send(N1, 'Salut')
    finish(processes[0] as FakeProcess, 'ok')
    service.setPermissionMode(N1, 'acceptEdits')
    expect((processes[0] as FakeProcess).killed).toBe(true)
    expect(service.liveCount()).toBe(0)
  })
})
