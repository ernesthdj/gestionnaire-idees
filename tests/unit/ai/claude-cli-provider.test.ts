import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ProviderError } from '../../../src/main/application/ai/AIProvider'
import { ClaudeCliProvider, type RunProcess } from '../../../src/main/infrastructure/ai/ClaudeCliProvider'

const Out = z.object({ title: z.string(), count: z.number() })

function provider(reply: { stdout?: string; stderr?: string; timedOut?: boolean }, path: string | null = 'claude.exe') {
  const calls: Parameters<RunProcess>[0][] = []
  const cli = new ClaudeCliProvider({
    claudePath: async () => path ?? undefined,
    model: () => 'claude-sonnet-5-5',
    cwd: () => 'C:/ws',
    run: async (input) => {
      calls.push(input)
      return { code: 0, stdout: reply.stdout ?? '', stderr: reply.stderr ?? '', timedOut: reply.timedOut ?? false }
    }
  })
  return { cli, calls }
}

const success = (structured: unknown) =>
  JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    structured_output: structured,
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 3, cache_creation_input_tokens: 2 },
    modelUsage: { 'claude-sonnet-5-5-20260101': {} }
  })

const request = (system = 'CONSIGNES') => ({
  system: [{ text: system, cacheable: true }],
  user: 'DONNÉES PERSONNELLES',
  schema: Out,
  maxTokens: 1000,
  effort: 'medium' as const
})

describe('Claude par le CLI (spec 010, F11)', () => {
  it('should_call_the_cli_with_fixed_restricted_arguments_and_send_the_data_by_stdin_only', async () => {
    const { cli, calls } = provider({ stdout: success({ title: 'Budget', count: 2 }) })
    const response = await cli.complete(request())
    expect(response.parsed).toEqual({ title: 'Budget', count: 2 })
    expect(response.usage).toEqual({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 3, cacheWriteTokens: 2 })
    expect(response.model).toBe('claude-sonnet-5-5-20260101')
    const { args, stdin, command, cwd } = calls[0] as Parameters<RunProcess>[0]
    expect(command).toBe('claude.exe')
    expect(cwd).toBe('C:/ws')
    expect(args).toEqual(expect.arrayContaining(['-p', '--output-format', 'json', '--strict-mcp-config']))
    expect(args[args.indexOf('--tools') + 1]).toBe('')
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('')
    expect(args[args.indexOf('--system-prompt') + 1]).toBe('CONSIGNES')
    expect(JSON.parse(args[args.indexOf('--json-schema') + 1] ?? '{}')).toMatchObject({ type: 'object' })
    expect(args.join(' ')).not.toContain('DONNÉES PERSONNELLES')
    expect(stdin).toBe('DONNÉES PERSONNELLES')
  })

  it('should_use_the_task_timeout_when_the_request_sets_one', async () => {
    const { cli, calls } = provider({ stdout: success({ title: 'x', count: 1 }) })
    await cli.complete({ ...request(), timeoutMs: 600_000 })
    expect(calls[0]?.timeoutMs).toBe(600_000)
  })

  it('should_move_long_instructions_to_stdin', async () => {
    const { cli, calls } = provider({ stdout: success({ title: 'x', count: 1 }) })
    await cli.complete(request('x'.repeat(25_000)))
    const { args, stdin } = calls[0] as Parameters<RunProcess>[0]
    expect(args).not.toContain('--system-prompt')
    expect(stdin.startsWith('<consignes>')).toBe(true)
  })

  it('should_return_no_result_when_the_output_does_not_match_the_schema_or_the_run_failed', async () => {
    expect((await provider({ stdout: success({ title: 'x' }) }).cli.complete(request())).parsed).toBeNull()
    const failed = JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true })
    expect(await provider({ stdout: failed }).cli.complete(request())).toMatchObject({
      parsed: null,
      stopReason: 'error'
    })
  })

  it('should_report_a_missing_cli_a_login_problem_a_timeout_and_an_unreadable_answer', async () => {
    await expect(provider({}, null).cli.complete(request())).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })
    await expect(provider({ stderr: 'Error: Not logged in' }).cli.complete(request())).rejects.toMatchObject({
      code: 'AUTH_FAILED'
    })
    await expect(provider({ timedOut: true }).cli.complete(request())).rejects.toBeInstanceOf(ProviderError)
    await expect(provider({ stdout: 'pas du json' }).cli.complete(request())).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE'
    })
  })

  it('should_be_available_only_when_the_cli_is_found', async () => {
    expect(await provider({}).cli.isAvailable()).toMatchObject({ up: true, model: 'claude-sonnet-5-5' })
    expect(await provider({}, null).cli.isAvailable()).toMatchObject({ up: false })
  })
})
