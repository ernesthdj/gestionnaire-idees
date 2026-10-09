import { tmpdir } from 'node:os'
import { z } from 'zod'
import { AppError } from '../../domain/errors'
import { assertSafeGhArgs, ghLoginArgs } from '../../domain/git/ghArgs'
import { resolveProgram, runProcess, type ProcessResult, type RunProcess } from '../process/ProcessRunner'

/**
 * Exécuteur `gh` (spec 021 research R9) : `gh.exe` par chemin absolu, sans shell, sous-commandes de la liste blanche
 * seulement, sans invite ni pager ni couleur, délai de 60 s ; la sortie n'est jamais journalisée, les JSON sont
 * revalidés par Zod par l'appelant.
 */

export interface GhRunnerDeps {
  readonly run?: RunProcess
  readonly program?: () => string | null
}

export const GH_TIMEOUT_MS = 60_000

function ghEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value
  return {
    ...env,
    GH_PROMPT_DISABLED: '1',
    GH_NO_UPDATE_NOTIFIER: '1',
    GH_NO_EXTENSION_UPDATE_NOTIFIER: '1',
    NO_COLOR: '1',
    GH_PAGER: 'cat',
    GH_SPINNER_DISABLED: '1'
  }
}

const LOGIN = z.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/)

export class GhRunner {
  constructor(private readonly deps: GhRunnerDeps = {}) {}

  installed(): boolean {
    return this.program() !== null
  }

  async run(args: readonly string[], options: { readonly stdin?: string } = {}): Promise<ProcessResult> {
    assertSafeGhArgs(args)
    const program = this.program()
    if (program === null)
      throw new AppError('GH_MISSING', 'gh (GitHub CLI) est introuvable : installe-le pour publier.')
    const result = await (this.deps.run ?? runProcess)({
      program,
      args: [...args],
      // Dossier neutre : `gh` ne doit jamais lire le dépôt d'un projet (aucun `--source`).
      cwd: tmpdir(),
      env: ghEnv(),
      timeoutMs: GH_TIMEOUT_MS,
      maxOutput: 1024 * 1024,
      ...(options.stdin === undefined ? {} : { stdin: options.stdin })
    })
    if (result.spawnFailed)
      throw new AppError('GH_MISSING', 'gh (GitHub CLI) est introuvable : installe-le pour publier.')
    if (result.timedOut) throw new AppError('TIMEOUT', 'GitHub n’a pas répondu à temps.')
    return result
  }

  /** Compte connecté ; `null` : gh absent ou non connecté (`gh auth login` à lancer par mentalyas). */
  async status(): Promise<{ readonly installed: boolean; readonly login: string | null }> {
    if (!this.installed()) return { installed: false, login: null }
    try {
      const result = await this.run(ghLoginArgs())
      const login = LOGIN.safeParse(result.stdout.trim())
      return { installed: true, login: result.code === 0 && login.success ? login.data : null }
    } catch {
      return { installed: true, login: null }
    }
  }

  private program(): string | null {
    return this.deps.program !== undefined ? this.deps.program() : resolveProgram('gh')
  }
}
