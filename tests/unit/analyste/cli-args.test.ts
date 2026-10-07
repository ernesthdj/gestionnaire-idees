import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { CompletionRequest } from '../../../src/main/application/ai/AIProvider'
import {
  ClaudeCliProvider,
  READ_ONLY_TOOLS,
  type RunProcess
} from '../../../src/main/infrastructure/ai/ClaudeCliProvider'
import type { TaskKind } from '../../../src/main/domain/ai/types'

const Out = z.object({ ok: z.boolean() })
const REPO = 'D:/dev/brainstormer'

function provider() {
  const calls: Parameters<RunProcess>[0][] = []
  const cli = new ClaudeCliProvider({
    claudePath: async () => 'claude.exe',
    model: () => 'claude-opus-5-5',
    cwd: () => 'C:/sandbox',
    run: async (input) => {
      calls.push(input)
      const stdout = JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        structured_output: { ok: true }
      })
      return { code: 0, stdout, stderr: '', timedOut: false }
    }
  })
  return { cli, calls }
}

type Request = CompletionRequest<{ ok: boolean }>
/** Une valeur `undefined` retire le champ de la demande. */
type Overrides = { [K in keyof Request]?: Request[K] | undefined }

const request = (overrides: Overrides = {}): Request => {
  const merged: Record<string, unknown> = {
    system: [{ text: 'CADRE', cacheable: true }],
    user: '<dossier version="1"></dossier>',
    schema: Out,
    maxTokens: 1000,
    task: 'analyste',
    tools: 'read-only',
    cwd: REPO,
    ...overrides
  }
  return Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined)) as unknown as Request
}

const valueOf = (args: readonly string[], flag: string): string | undefined => args[args.indexOf(flag) + 1]

describe('arguments du CLI de l’Analyste (spec 019 T017, L3-analyste-analyse §2)', () => {
  it('should_give_only_read_glob_grep_in_the_designated_repository_when_the_task_is_analyste', async () => {
    const { cli, calls } = provider()
    await cli.complete(request())
    const { args, cwd, stdin } = calls[0] as Parameters<RunProcess>[0]
    expect(cwd).toBe(REPO)
    expect(valueOf(args, '--tools')).toBe('Read Glob Grep')
    expect(valueOf(args, '--allowedTools')).toBe('Read Glob Grep')
    expect(valueOf(args, '--setting-sources')).toBe('')
    expect(valueOf(args, '--permission-prompts')).toBe('none')
    expect(valueOf(args, '--max-turns')).toBe('40')
    expect(args).toEqual(
      expect.arrayContaining(['-p', '--strict-mcp-config', '--no-session-persistence', '--disable-slash-commands'])
    )
    // Aucun outil d'écriture ni de commande, aucun mode qui contourne les permissions.
    const joined = args.join(' ')
    for (const forbidden of ['Write', 'Edit', 'Bash', 'WebFetch', 'WebSearch', 'bypassPermissions', '--mcp-config']) {
      expect(joined).not.toContain(forbidden)
    }
    expect(READ_ONLY_TOOLS.split(' ')).toEqual(['Read', 'Glob', 'Grep'])
    // Le dossier passe par l'entrée standard, jamais en argument.
    expect(joined).not.toContain('<dossier')
    expect(stdin).toContain('<dossier')
  })

  it('should_keep_no_tool_and_the_empty_sandbox_for_any_other_task', async () => {
    const { cli, calls } = provider()
    await cli.complete(request({ task: 'widget', tools: undefined, cwd: undefined }))
    const { args, cwd } = calls[0] as Parameters<RunProcess>[0]
    expect(cwd).toBe('C:/sandbox')
    expect(valueOf(args, '--tools')).toBe('')
    expect(args).not.toContain('--allowedTools')
    expect(args).not.toContain('--max-turns')
  })

  it('should_refuse_tools_or_a_folder_for_any_task_other_than_analyste', async () => {
    for (const task of ['widget', 'reprise_guide', 'categoriser', undefined] as (TaskKind | undefined)[]) {
      const { cli, calls } = provider()
      await expect(cli.complete(request({ task }))).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })
      await expect(cli.complete(request({ task, tools: undefined }))).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })
      expect(calls).toHaveLength(0)
    }
  })

  it('should_refuse_a_missing_or_relative_folder_even_for_analyste', async () => {
    const { cli, calls } = provider()
    await expect(cli.complete(request({ cwd: undefined }))).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })
    await expect(cli.complete(request({ cwd: 'relatif/depot' }))).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })
    expect(calls).toHaveLength(0)
  })

  it('should_pass_the_cancellation_signal_and_report_a_cancelled_run', async () => {
    const controller = new AbortController()
    const calls: Parameters<RunProcess>[0][] = []
    const cli = new ClaudeCliProvider({
      claudePath: async () => 'claude.exe',
      model: () => 'm',
      cwd: () => 'C:/sandbox',
      run: async (input) => {
        calls.push(input)
        controller.abort()
        return { code: null, stdout: '', stderr: '', timedOut: false }
      }
    })
    await expect(cli.complete(request({ signal: controller.signal }))).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE'
    })
    expect(calls[0]?.signal).toBe(controller.signal)
  })
})
