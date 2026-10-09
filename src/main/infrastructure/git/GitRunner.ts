import { mkdirSync } from 'node:fs'
import { assertSafeArgs, gitPrefix } from '../../domain/git/args'
import { resolveProgram, runProcess, type ProcessResult, type RunProcess } from '../process/ProcessRunner'

/**
 * Exécuteur git de la spec 021 (research R1, R2, R11) : chaque commande reçoit le préfixe sûr (hooks coupés hors
 * confiance et sur `pr/*`), passe par `assertSafeArgs`, tourne sans shell avec git par chemin absolu, sans invite et
 * dans un environnement débarrassé des variables `GIT_*` héritées (elles pourraient rediriger le dépôt ou la
 * configuration).
 */

export interface GitRunOptions {
  readonly trusted: boolean
  readonly onPrBranch?: boolean
  /** Lecture : `GIT_OPTIONAL_LOCKS=0` (ne prend pas le verrou de l'index, research R4). */
  readonly read?: boolean
  readonly stdin?: string
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
  readonly maxOutput?: number
  readonly onStderr?: (text: string) => void
}

export interface GitRunnerDeps {
  /** Dossier vide des hooks coupés (`<profil>/git-empty-hooks`), créé au besoin. */
  readonly emptyHooksDir: string
  readonly run?: RunProcess
  readonly program?: () => string | null
  /**
   * TESTS SEULEMENT (intégration, e2e avec `--e2e`) : autorise le transport local vers un dépôt nu de test. En production
   * seuls `https` et `ssh` passent (préfixe R2).
   */
  readonly allowLocalTransportForTests?: boolean
}

export const DEFAULT_GIT_TIMEOUT_MS = 60_000

/** Environnement de git : celui du système sans les `GIT_*` hérités, plus les réglages de l'app. */
export function gitEnv(read: boolean): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !/^GIT_/i.test(key)) env[key] = value
  }
  env['GIT_TERMINAL_PROMPT'] = '0'
  env['LC_ALL'] = 'C'
  env['GCM_INTERACTIVE'] = 'never'
  if (read) env['GIT_OPTIONAL_LOCKS'] = '0'
  return env
}

export class GitRunner {
  private hooksReady = false

  constructor(private readonly deps: GitRunnerDeps) {}

  /** git est-il installé ? */
  available(): boolean {
    return this.program() !== null
  }

  async run(cwd: string, args: readonly string[], options: GitRunOptions): Promise<ProcessResult> {
    assertSafeArgs(args)
    const program = this.program()
    if (program === null) {
      return { code: null, stdout: '', stderr: '', truncated: false, timedOut: false, spawnFailed: true }
    }
    if (!this.hooksReady) {
      mkdirSync(this.deps.emptyHooksDir, { recursive: true })
      this.hooksReady = true
    }
    const prefix = gitPrefix({
      trusted: options.trusted,
      onPrBranch: options.onPrBranch === true,
      emptyHooksDir: this.deps.emptyHooksDir
    })
    return (this.deps.run ?? runProcess)({
      program,
      args: [
        ...prefix,
        ...(this.deps.allowLocalTransportForTests === true ? ['-c', 'protocol.file.allow=always'] : []),
        ...args
      ],
      cwd,
      env: gitEnv(options.read === true),
      timeoutMs: options.timeoutMs ?? DEFAULT_GIT_TIMEOUT_MS,
      ...(options.stdin === undefined ? {} : { stdin: options.stdin }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.maxOutput === undefined ? {} : { maxOutput: options.maxOutput }),
      ...(options.onStderr === undefined ? {} : { onStderr: options.onStderr })
    })
  }

  private program(): string | null {
    return this.deps.program !== undefined ? this.deps.program() : resolveProgram('git')
  }
}
