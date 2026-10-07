import { spawn } from 'node:child_process'
import { isAbsolute } from 'node:path'
import { z } from 'zod'
import {
  ProviderError,
  type AIProvider,
  type CompletionRequest,
  type CompletionResponse,
  type ProviderStatus
} from '../../application/ai/AIProvider'
import type { Usage } from '../../domain/ai/types'

/** Exécution d'un processus : sortie standard, erreur standard et code de fin. Remplaçable dans les tests. */
export type RunProcess = (input: {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly stdin: string
  readonly timeoutMs: number
  /** Annulation : le processus est arrêté. */
  readonly signal?: AbortSignal
}) => Promise<{
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
  readonly timedOut: boolean
}>

export interface ClaudeCliOptions {
  readonly claudePath: () => Promise<string | undefined>
  readonly model: () => string
  /** Dossier de travail vide propre à l'app : aucune lecture de projet, aucun réglage chargé. */
  readonly cwd: () => string
  /**
   * Dossiers interdits aux outils de lecture de l'Analyste (spec 019 R1) : profils de l'app, dossiers de secrets. La
   * preuve R1 a montré que `Read Glob Grep` lisent hors du dossier de travail : ces dossiers sont refusés par règle.
   */
  readonly deniedReadDirs: () => readonly string[]
  readonly run?: RunProcess
  readonly timeoutMs?: number
}

/** Au-delà, les consignes passent par l'entrée standard (limite de ligne de commande Windows ≈ 32 000 caractères). */
const MAX_SYSTEM_ARG = 20_000
const DEFAULT_TIMEOUT_MS = 240_000

/** Seule tâche qui reçoit des outils, en lecture seule (spec 019, constitution IV). */
export const READ_ONLY_TASK = 'analyste'
/** Outils de lecture et de recherche de Claude Code : rien n'écrit, rien ne lance de commande. */
export const READ_ONLY_TOOLS = 'Read Glob Grep'
/** Tours d'outils au plus pour une analyse (`L3-analyste-analyse.md` §2). */
export const READ_ONLY_MAX_TURNS = 40

/**
 * Chemin absolu → motif de règle de permission de Claude Code (`//c/Users/…/**`, `//home/…/**`) ; `null` si le chemin
 * n'est pas absolu ou contient un caractère qui changerait le sens de la règle.
 */
export function denyPattern(dir: string): string | null {
  const path = dir.replace(/\\/g, '/').replace(/\/+$/, '')
  if (/[()*?[\]{}\n\r]/.test(path) || path.split('/').includes('..')) return null
  const drive = /^([A-Za-z]):\/(.*)$/.exec(path)
  if (drive !== null) return `//${(drive[1] as string).toLowerCase()}/${drive[2] as string}/**`
  return path.startsWith('/') && path.length > 1 ? `/${path}/**` : null
}

/** Règles `--disallowedTools` : chaque dossier interdit, pour chacun des trois outils de lecture. */
export function denyRules(dirs: readonly string[]): string[] {
  const patterns = dirs.map(denyPattern)
  if (patterns.length === 0 || patterns.some((pattern) => pattern === null)) {
    throw new ProviderError('AI_UNAVAILABLE', 'Dossiers protégés absents ou invalides : lecture refusée', false)
  }
  return READ_ONLY_TOOLS.split(' ').flatMap((tool) => patterns.map((pattern) => `${tool}(${pattern as string})`))
}

const ResultLine = z.object({
  is_error: z.boolean().optional(),
  subtype: z.string().optional(),
  result: z.string().optional(),
  structured_output: z.unknown().optional(),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      cache_read_input_tokens: z.number().optional(),
      cache_creation_input_tokens: z.number().optional()
    })
    .optional(),
  modelUsage: z.record(z.string(), z.unknown()).optional()
})

export const runProcess: RunProcess = ({ command, args, cwd, stdin, timeoutMs, signal }) =>
  new Promise((resolve) => {
    const child = spawn(command, [...args], { cwd, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)
    const abort = (): void => void child.kill()
    if (signal?.aborted === true) abort()
    signal?.addEventListener('abort', abort, { once: true })
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => (stdout += chunk))
    child.stderr.on('data', (chunk: string) => (stderr = (stderr + chunk).slice(-4000)))
    child.on('error', () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      resolve({ code: null, stdout, stderr, timedOut })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      resolve({ code, stdout, stderr, timedOut })
    })
    child.stdin.on('error', () => undefined)
    child.stdin.end(stdin)
  })

/**
 * Claude par le CLI officiel de mentalyas (spec 010, F11) : `claude -p` avec un format de sortie imposé
 * (`--json-schema`, tiré du schéma Zod de la tâche), sans outil, sans serveur MCP, sans réglage chargé, dans un dossier
 * vide. L'abonnement remplace l'API Anthropic : aucune clé. Les données passent par l'entrée standard, jamais en argument.
 * Seule exception (spec 019, constitution IV) : la tâche `analyste` reçoit `Read Glob Grep`, dans le dépôt désigné.
 */
export class ClaudeCliProvider implements AIProvider {
  readonly id = 'claude' as const

  constructor(private readonly options: ClaudeCliOptions) {}

  currentModel(): string {
    return this.options.model()
  }

  async isAvailable(): Promise<ProviderStatus> {
    const path = await this.options.claudePath()
    return path === undefined
      ? { up: false, reason: 'Claude Code est introuvable sur cette machine', problem: 'not_running' }
      : { up: true, model: this.options.model() }
  }

  async complete<T>(request: CompletionRequest<T>): Promise<CompletionResponse<T>> {
    const readOnly = this.readOnlyDir(request)
    const denied = readOnly === null ? [] : this.deniedFor(readOnly)
    const command = await this.options.claudePath()
    if (command === undefined) throw new ProviderError('AI_UNAVAILABLE', 'Claude Code est introuvable', true)
    const model = request.model ?? this.options.model()
    const system = request.system.map((block) => block.text).join('\n\n')
    const systemInArgs = system.length <= MAX_SYSTEM_ARG
    const args = [
      '-p',
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(z.toJSONSchema(request.schema, { target: 'draft-7', unrepresentable: 'any' })),
      '--model',
      model,
      '--tools',
      readOnly === null ? '' : READ_ONLY_TOOLS,
      ...(readOnly === null ? [] : ['--allowedTools', READ_ONLY_TOOLS, '--disallowedTools', ...denied]),
      '--setting-sources',
      '',
      '--strict-mcp-config',
      '--no-session-persistence',
      '--disable-slash-commands',
      '--permission-prompts',
      'none',
      ...(readOnly === null ? [] : ['--max-turns', String(READ_ONLY_MAX_TURNS)]),
      ...(request.effort === undefined ? [] : ['--effort', request.effort]),
      ...(systemInArgs ? ['--system-prompt', system] : [])
    ]
    const stdin = systemInArgs ? request.user : `<consignes>\n${system}\n</consignes>\n\n${request.user}`
    const run = this.options.run ?? runProcess
    const outcome = await run({
      command,
      args,
      cwd: readOnly ?? this.options.cwd(),
      stdin,
      timeoutMs: request.timeoutMs ?? this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      ...(request.signal === undefined ? {} : { signal: request.signal })
    })
    if (request.signal?.aborted === true) throw new ProviderError('AI_UNAVAILABLE', 'Demande annulée', false)
    if (outcome.timedOut) throw new ProviderError('AI_UNAVAILABLE', 'Claude a mis trop de temps à répondre', true)
    if (/not logged in|log in|login|authenticat/i.test(outcome.stderr)) {
      throw new ProviderError('AUTH_FAILED', 'Claude Code n’est pas connecté : lance `claude` pour te connecter', false)
    }
    const line = outcome.stdout
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.startsWith('{'))
      .at(-1)
    let parsedLine: z.infer<typeof ResultLine> | undefined
    try {
      const json: unknown = line === undefined ? undefined : JSON.parse(line)
      const result = ResultLine.safeParse(json)
      parsedLine = result.success ? result.data : undefined
    } catch {
      parsedLine = undefined
    }
    if (parsedLine === undefined) throw new ProviderError('AI_UNAVAILABLE', 'Réponse illisible de Claude Code', true)
    const usage: Usage = {
      inputTokens: parsedLine.usage?.input_tokens ?? 0,
      outputTokens: parsedLine.usage?.output_tokens ?? 0,
      cacheReadTokens: parsedLine.usage?.cache_read_input_tokens ?? 0,
      cacheWriteTokens: parsedLine.usage?.cache_creation_input_tokens ?? 0
    }
    const usedModel = Object.keys(parsedLine.modelUsage ?? {})[0] ?? model
    if (parsedLine.is_error === true || parsedLine.subtype !== 'success') {
      return { parsed: null, usage, stopReason: 'error', model: usedModel }
    }
    const output = request.schema.safeParse(parsedLine.structured_output)
    return { parsed: output.success ? output.data : null, usage, stopReason: 'end_turn', model: usedModel }
  }

  /**
   * Dossier des outils de lecture, ou `null` sans outil. Toute demande d'outils ou de dossier hors de la tâche
   * `analyste` est refusée : aucune autre tâche automatique ne lit le disque (constitution IV).
   */
  private readOnlyDir<T>(request: CompletionRequest<T>): string | null {
    if (request.tools === undefined && request.cwd === undefined) return null
    if (request.task !== READ_ONLY_TASK || request.tools !== 'read-only') {
      throw new ProviderError('AI_UNAVAILABLE', 'Les outils de lecture sont réservés à la tâche analyste', false)
    }
    if (request.cwd === undefined || !isAbsolute(request.cwd)) {
      throw new ProviderError('AI_UNAVAILABLE', 'Dossier de lecture absent ou relatif', false)
    }
    return request.cwd
  }

  /** Règles de refus ; un dépôt situé dans un dossier protégé est refusé (il serait illisible ou exposerait ce dossier). */
  private deniedFor(repo: string): string[] {
    const dirs = this.options.deniedReadDirs()
    const norm = (path: string): string => path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() + '/'
    if (dirs.some((dir) => norm(repo).startsWith(norm(dir)))) {
      throw new ProviderError('AI_UNAVAILABLE', 'Le dépôt est dans un dossier protégé', false)
    }
    return denyRules(dirs)
  }
}
