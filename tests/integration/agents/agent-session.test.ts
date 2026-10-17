import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  AGENT_SKILLS_PLUGIN,
  agentSessionArgs,
  createAgentSessionRunner,
  writeSkillsPlugin,
  type AgentSkillSource
} from '../../../src/main/infrastructure/claude/AgentSession'
import type { RunProcess } from '../../../src/main/infrastructure/ai/ClaudeCliProvider'
import type { AgentProfileView } from '../../../src/shared/agents/profile'

const profile = (skills: readonly string[]): AgentProfileView => ({
  id: 'backend',
  name: 'Agent backend',
  role: 'backend',
  instructions: '',
  permissionMode: 'acceptEdits',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  skills,
  updatedAt: 0,
  delivered: 0
})

const success = JSON.stringify({ type: 'result', subtype: 'success', result: 'Rapport' })

describe('skills transmis à la session d’un agent (L1o D6, T010)', () => {
  let root: string
  let sources: Map<string, AgentSkillSource>

  const skill = (name: string, body = `Skill ${name}`): AgentSkillSource => {
    const dir = join(root, 'source', name)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${body}\n---\n${body}\n`)
    return { name, dir }
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-agent-session-'))
    sources = new Map([
      ['perso:journal', skill('journal')],
      ['projet:g1:selfdoubt', skill('selfdoubt')]
    ])
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const runnerWith = (run: RunProcess) =>
    createAgentSessionRunner({
      claudePath: async () => 'claude',
      run,
      skills: { resolve: (id) => sources.get(id) ?? null, workDir: join(root, 'sessions') }
    })

  const request = (skills: readonly string[]) => ({
    profile: profile(skills),
    sessionId: 'session-1',
    cwd: root,
    systemPrompt: 'Mission',
    prompt: 'Faire X'
  })

  it('should_load_the_checked_skills_as_a_plugin_when_the_profile_has_skills', async () => {
    let pluginDir: string | undefined
    let seen: string[] = []
    const result = await runnerWith(async ({ args }) => {
      pluginDir = args[args.indexOf('--plugin-dir') + 1]
      if (pluginDir !== undefined) {
        seen = readdirSync(join(pluginDir, 'skills')).sort()
        expect(JSON.parse(readFileSync(join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf8')).name).toBe(
          AGENT_SKILLS_PLUGIN
        )
      }
      return { code: 0, stdout: success, stderr: '', timedOut: false }
    })(request(['perso:journal', 'projet:g1:selfdoubt']))
    expect(result).toEqual({ ok: true, text: 'Rapport' })
    expect(seen).toEqual(['journal', 'selfdoubt'])
    // Le plugin ne vit que le temps de la session.
    expect(pluginDir !== undefined && existsSync(pluginDir)).toBe(false)
  })

  it('should_not_pass_a_plugin_when_no_checked_skill_resolves', async () => {
    let args: readonly string[] = []
    await runnerWith(async (input) => {
      args = input.args
      return { code: 0, stdout: success, stderr: '', timedOut: false }
    })(request(['perso:disparu']))
    expect(args).not.toContain('--plugin-dir')
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('')
  })

  it('should_flag_a_missing_session_only_when_a_resume_finds_no_conversation', async () => {
    // Réponse réelle de `claude -p --resume <id inconnu>` (relevée le 2026-10-17), réduite à ce qui compte.
    const missing = JSON.stringify({
      type: 'result',
      subtype: 'error_during_execution',
      is_error: true,
      num_turns: 0,
      errors: ['No conversation found with session ID: session-1']
    })
    const run: RunProcess = async () => ({ code: 0, stdout: missing, stderr: '', timedOut: false })
    expect(await runnerWith(run)({ ...request([]), resume: true })).toMatchObject({ ok: false, missingSession: true })
    expect((await runnerWith(run)(request([]))).missingSession).toBeUndefined()
  })

  it('should_remove_the_plugin_when_the_session_fails', async () => {
    const result = await runnerWith(async () => ({ code: 1, stdout: '', stderr: 'boom', timedOut: true }))(
      request(['perso:journal'])
    )
    expect(result.ok).toBe(false)
    expect(readdirSync(join(root, 'sessions'))).toEqual([])
  })

  it('should_keep_the_first_skill_and_skip_invalid_names_and_links_when_writing_the_plugin', () => {
    const first = skill('journal', 'premier')
    const twin = { name: 'journal', dir: skill('autre', 'second').dir }
    mkdirSync(join(root, 'dehors'))
    writeFileSync(join(root, 'dehors', 'secret.txt'), 'x')
    symlinkSync(join(root, 'dehors'), join(first.dir, 'lien'), 'junction')
    const out = writeSkillsPlugin(join(root, 'plugin'), [first, twin, { name: '../evasion', dir: first.dir }])
    expect(out).toBe(join(root, 'plugin'))
    expect(readdirSync(join(root, 'plugin', 'skills'))).toEqual(['journal'])
    expect(readFileSync(join(root, 'plugin', 'skills', 'journal', 'SKILL.md'), 'utf8')).toContain('premier')
    expect(existsSync(join(root, 'plugin', 'skills', 'journal', 'lien'))).toBe(false)
  })

  it('should_build_fixed_cli_arguments', () => {
    const args = agentSessionArgs({
      sessionId: 's',
      model: 'm',
      effort: 'high',
      permissionMode: 'bypassPermissions',
      systemPrompt: 'sp'
    })
    expect(args).toContain('--allow-dangerously-skip-permissions')
    expect(args).not.toContain('--plugin-dir')
    // L2-pipeline-optimal D11 (T014) : aucun serveur MCP, ni les connecteurs claude.ai de mentalyas (Gmail, Docs…).
    expect(args).toContain('--strict-mcp-config')
    expect(JSON.parse(args[args.indexOf('--mcp-config') + 1] ?? '')).toEqual({ mcpServers: {} })
    // L2-pipeline-optimal D3 : une passe suivante reprend sa session au lieu d'en créer une.
    expect(args[args.indexOf('--session-id') + 1]).toBe('s')
    const resumed = agentSessionArgs({
      sessionId: 's',
      resume: true,
      model: 'm',
      effort: 'high',
      permissionMode: 'default',
      systemPrompt: 'sp'
    })
    expect(resumed[resumed.indexOf('--resume') + 1]).toBe('s')
    expect(resumed).not.toContain('--session-id')
    // Flux continu (L1o D18) : ce que fait l'agent arrive au fil de l'eau.
    expect(args[args.indexOf('--output-format') + 1]).toBe('stream-json')
    expect(args).toContain('--verbose')
    const at = args.indexOf('--setting-sources')
    expect(args.slice(at, at + 2)).toEqual(['--setting-sources', ''])
  })

  it('should_pass_each_stream_event_while_the_agent_works_and_return_the_final_result', async () => {
    const events: string[] = []
    const lines = [
      { type: 'system', subtype: 'init', session_id: 's', model: 'm', apiKeySource: 'none' },
      {
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: 't1', name: 'Write', input: { file_path: 'a.ts' } }] }
      },
      { type: 'result', subtype: 'success', is_error: false, result: 'Rapport' }
    ].map((line) => JSON.stringify(line))
    const run: RunProcess = async ({ onStdoutLine }) => {
      for (const line of lines) onStdoutLine?.(line)
      return { code: 0, stdout: `${lines.join('\n')}\n`, stderr: '', timedOut: false }
    }
    const result = await runnerWith(run)({ ...request([]), onEvent: (event) => events.push(event.kind) })
    expect(events).toEqual(['init', 'tool', 'result'])
    expect(result).toEqual({ ok: true, text: 'Rapport' })
  })

  it('should_write_nothing_when_there_is_no_skill', () => {
    expect(writeSkillsPlugin(join(root, 'plugin'), [])).toBeUndefined()
    expect(existsSync(join(root, 'plugin'))).toBe(false)
  })
})
