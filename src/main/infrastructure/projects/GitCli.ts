import { resolveProgram, runProcess } from '../process/ProcessRunner'

export interface GitResult {
  /** `null` : git introuvable, arrêté (délai) ou lancement impossible. */
  readonly code: number | null
  readonly output: string
}

const OUTPUT_MAX = 4_000

/**
 * Chemin absolu de git trouvé dans les dossiers ABSOLUS du PATH ; `null` s'il est absent (un `git.exe` du dossier
 * courant, celui du projet, n'est jamais pris).
 */
export function resolveGit(path = process.env['PATH'] ?? ''): string | null {
  return resolveProgram('git', path)
}

/**
 * Lance `git` (spec 016 FR-005, spec 019) : sans shell, arguments fixes construits par le main, dossier imposé, délai
 * borné, sans invite. Enveloppe compatible de l'exécuteur commun (spec 021 research R1) ; `stdin` passe un texte (un
 * message de commit, jamais en argument).
 */
export async function runGit(
  cwd: string,
  args: readonly string[],
  timeoutMs = 30_000,
  stdin?: string
): Promise<GitResult> {
  const program = resolveGit()
  if (program === null) return { code: null, output: '' }
  const result = await runProcess({
    program,
    args,
    cwd,
    env: { ...(process.env as Record<string, string>), GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' },
    timeoutMs,
    maxOutput: 1024 * 1024,
    ...(stdin === undefined ? {} : { stdin })
  })
  const output = `${result.stdout}${result.stderr}`.trim().slice(-OUTPUT_MAX)
  return { code: result.code, output }
}
