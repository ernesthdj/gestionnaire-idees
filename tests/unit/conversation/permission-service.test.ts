import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PermissionService,
  type PermissionAnswer,
  type PermissionEvent
} from '../../../src/main/application/conversation/PermissionService'
import type { PermissionRule } from '../../../src/main/domain/conversation/permissions'
import type { PermissionDecision } from '../../../src/main/infrastructure/db/repositories/PermissionRepository'

describe('demandes de permission relayées dans le chat (spec 014 US1)', () => {
  let rules: (PermissionRule & { projectKey: string })[]
  let logged: [string, string, PermissionDecision][]
  let events: PermissionEvent[]
  let service: PermissionService

  beforeEach(() => {
    vi.useFakeTimers()
    rules = []
    logged = []
    events = []
    service = new PermissionService({
      repository: {
        rules: (key) =>
          rules
            .filter((rule) => rule.projectKey === key)
            .map((rule, index) => ({ ...rule, id: String(index), createdAt: '' })),
        addRule: (projectKey, rule) => void rules.push({ projectKey, ...rule }),
        log: (neuronId, tool, decision) => void logged.push([neuronId, tool, decision])
      },
      projectKeyOf: (neuronId) => (neuronId === 'n2' ? 'c:/autre' : 'c:/p'),
      emit: (event) => void events.push(event),
      now: () => new Date('2026-10-06T10:00:00.000Z'),
      timeoutMs: 60_000
    })
  })
  afterEach(() => vi.useRealTimers())

  const requestId = (): string => {
    const event = events.find((entry) => entry.type === 'chat:permission')
    return event?.type === 'chat:permission' ? event.payload.id : ''
  }

  it('should_wait_for_mentalyas_and_allow_once', async () => {
    const answer = service.request('n1', 'Bash', { command: 'npm test' })
    expect(events[0]).toEqual({
      type: 'chat:permission',
      payload: {
        id: expect.any(String),
        neuronId: 'n1',
        tool: 'Bash',
        detail: { kind: 'command', command: 'npm test', cwd: null },
        at: '2026-10-06T10:00:00.000Z'
      }
    })
    expect(service.open('n1')).toHaveLength(1)
    service.decide(requestId(), 'allow')
    await expect(answer).resolves.toEqual({ behavior: 'allow', updatedInput: { command: 'npm test' } })
    expect(service.open('n1')).toEqual([])
    expect(logged).toEqual([['n1', 'Bash', 'allow']])
    expect(rules).toEqual([])
  })

  it('should_refuse_with_a_clear_message_for_claude', async () => {
    const answer = service.request('n1', 'Write', { file_path: 'a.md', content: 'x' })
    service.decide(requestId(), 'deny')
    const result: PermissionAnswer = await answer
    expect(result.behavior).toBe('deny')
    expect(events.at(-1)).toEqual({
      type: 'chat:permissionResolved',
      payload: { neuronId: 'n1', requestId: requestId(), decision: 'deny' }
    })
  })

  it('should_remember_always_for_this_project_only', async () => {
    const first = service.request('n1', 'Bash', { command: 'npm test' })
    service.decide(requestId(), 'always')
    await first
    expect(rules).toEqual([{ projectKey: 'c:/p', tool: 'Bash', pattern: 'npm test' }])
    events = []
    await expect(service.request('n1', 'Bash', { command: 'npm test' })).resolves.toMatchObject({ behavior: 'allow' })
    expect(events).toEqual([])
    expect(logged.at(-1)).toEqual(['n1', 'Bash', 'rule'])
    // Autre commande, ou autre projet : la demande revient.
    void service.request('n1', 'Bash', { command: 'npm install' })
    void service.request('n2', 'Bash', { command: 'npm test' })
    expect(events.filter((event) => event.type === 'chat:permission')).toHaveLength(2)
  })

  it('should_refuse_open_requests_when_the_chat_closes_or_the_app_quits', async () => {
    const a = service.request('n1', 'Bash', { command: 'ls' })
    const b = service.request('n2', 'Bash', { command: 'ls' })
    service.cancel('n1')
    await expect(a).resolves.toMatchObject({ behavior: 'deny' })
    expect(service.open('n2')).toHaveLength(1)
    service.cancelAll()
    await expect(b).resolves.toMatchObject({ behavior: 'deny' })
    expect(logged.map((entry) => entry[2])).toEqual(['expired', 'expired'])
  })

  it('should_refuse_a_request_left_without_answer_too_long', async () => {
    const answer = service.request('n1', 'Bash', { command: 'ls' })
    vi.advanceTimersByTime(60_000)
    await expect(answer).resolves.toMatchObject({ behavior: 'deny' })
    expect(() => service.decide(requestId(), 'allow')).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
  })

  it('should_trace_a_mode_change_without_any_tool_input', () => {
    service.modeChanged('n1', 'acceptEdits')
    expect(logged).toEqual([['n1', 'acceptEdits', 'mode']])
  })
})
