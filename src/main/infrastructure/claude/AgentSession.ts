import { randomUUID } from 'node:crypto'
import { parseStreamLine } from '../../domain/conversation/streamEvents'
import { cpSync, lstatSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentSessionRunner } from '../../application/agents/PipelineEngine'
import { isSkillName } from '../../domain/skills/paths'
import { runProcess, type RunProcess } from '../ai/ClaudeCliProvider'

const SESSION_TIMEOUT_MS = 30 * 60_000

/** Nom du plugin qui porte les skills d'un agent : Claude les voit sous `agent-skills:<nom>`. */
export const AGENT_SKILLS_PLUGIN = 'agent-skills'

/** Skill coché dans un profil, résolu par l'inventaire (dossier réel, jamais un chemin venu du renderer). */
export interface AgentSkillSource {
  readonly name: string
  readonly dir: string
}

/**
 * Plugin d'une session (L1o D6) : `--setting-sources ""` ne charge aucun skill personnel ni de projet, alors les skills
 * du profil sont copiés dans un plugin à part, chargé par `--plugin-dir`. Ni hook ni réglage : seulement
 * `plugin.json` et les dossiers des skills, sans lien symbolique. Rend `undefined` s'il n'y a rien à copier.
 */
export function writeSkillsPlugin(root: string, skills: readonly AgentSkillSource[]): string | undefined {
  // Deux skills de même nom (personnel et de projet) : le premier coché l'emporte.
  const kept = new Map<string, AgentSkillSource>()
  for (const skill of skills) if (isSkillName(skill.name) && !kept.has(skill.name)) kept.set(skill.name, skill)
  if (kept.size === 0) return undefined
  mkdirSync(join(root, '.claude-plugin'), { recursive: true })
  writeFileSync(
    join(root, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: AGENT_SKILLS_PLUGIN, version: '1.0.0', description: 'Skills du profil de l’agent' })
  )
  for (const skill of kept.values()) {
    cpSync(skill.dir, join(root, 'skills', skill.name), {
      recursive: true,
      filter: (source) => !lstatSync(source).isSymbolicLink()
    })
  }
  return root
}

/** Arguments fixes d'une session d'agent (`claude -p`) : rien ne vient du texte de la tâche. */
export function agentSessionArgs(input: {
  readonly sessionId: string
  readonly model: string
  readonly effort: string
  readonly permissionMode: string
  readonly systemPrompt: string
  readonly pluginDir?: string
}): string[] {
  return [
    '-p',
    // Flux continu (L1o D18) : ce que fait l'agent arrive au fil de l'eau ; la dernière ligne est le résultat.
    '--output-format',
    'stream-json',
    '--verbose',
    '--session-id',
    input.sessionId,
    '--model',
    input.model,
    '--effort',
    input.effort,
    // Ni hooks ni réglages de l'utilisateur ou du projet : le CLAUDE.md du projet est lu par l'agent, pas chargé d'office.
    '--setting-sources',
    '',
    '--permission-mode',
    input.permissionMode,
    ...(input.permissionMode === 'bypassPermissions' ? ['--allow-dangerously-skip-permissions'] : []),
    ...(input.pluginDir === undefined ? [] : ['--plugin-dir', input.pluginDir]),
    '--append-system-prompt',
    input.systemPrompt
  ]
}

export interface AgentSessionOptions {
  readonly claudePath: () => Promise<string | undefined>
  readonly run?: RunProcess
  readonly timeoutMs?: number
  /** Skills des profils : résolution d'un identifiant, et dossier où naissent les plugins des sessions. */
  readonly skills?: {
    readonly resolve: (skillId: string) => AgentSkillSource | null
    readonly workDir: string
  }
}

/** Lance une session `claude -p` par agent : la mission arrive par l'entrée standard, le rapport est le champ `result`. */
export const createAgentSessionRunner =
  (options: AgentSessionOptions): AgentSessionRunner =>
  async (request) => {
    const command = await options.claudePath()
    if (command === undefined) return { ok: false, text: '', error: 'Claude Code est introuvable.' }
    const run = options.run ?? runProcess
    const pluginRoot = options.skills === undefined ? undefined : join(options.skills.workDir, randomUUID())
    const sources = request.profile.skills
      .map((skillId) => options.skills?.resolve(skillId) ?? null)
      .filter((source): source is AgentSkillSource => source !== null)
    const pluginDir = pluginRoot === undefined ? undefined : writeSkillsPlugin(pluginRoot, sources)
    const outcome = await run({
      command,
      args: agentSessionArgs({
        sessionId: request.sessionId,
        model: request.profile.model,
        effort: request.profile.effort,
        permissionMode: request.profile.permissionMode,
        systemPrompt: request.systemPrompt,
        ...(pluginDir === undefined ? {} : { pluginDir })
      }),
      cwd: request.cwd,
      stdin: request.prompt,
      timeoutMs: options.timeoutMs ?? SESSION_TIMEOUT_MS,
      ...(request.onEvent === undefined
        ? {}
        : {
            onStdoutLine: (line: string) => {
              for (const event of parseStreamLine(line)) request.onEvent?.(event)
            }
          }),
      ...(request.signal === undefined ? {} : { signal: request.signal })
    }).finally(() => {
      if (pluginRoot !== undefined) rmSync(pluginRoot, { recursive: true, force: true })
    })
    if (request.signal?.aborted === true) return { ok: false, text: '', error: 'Session annulée.' }
    if (outcome.timedOut) return { ok: false, text: '', error: 'L’agent a mis trop de temps.' }
    const line = outcome.stdout
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.startsWith('{'))
      .at(-1)
    if (line === undefined) return { ok: false, text: '', error: 'Réponse illisible de Claude Code.' }
    try {
      const json = JSON.parse(line) as { is_error?: boolean; subtype?: string; result?: string }
      if (json.is_error === true || (json.subtype !== undefined && json.subtype !== 'success')) {
        return { ok: false, text: '', error: json.result ?? 'La session a échoué.' }
      }
      return { ok: true, text: json.result ?? '' }
    } catch {
      return { ok: false, text: '', error: 'Réponse illisible de Claude Code.' }
    }
  }
