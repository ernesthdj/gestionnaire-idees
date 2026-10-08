import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { delimiter, dirname, isAbsolute, join } from 'node:path'

/**
 * Vérifications d'une mise à jour de l'Analyste (spec 019 T031, research R7, constitution I) : npm est un programme
 * Node, lancé par `node` avec le `npm-cli.js` installé à côté de `npm.cmd`, tous deux par chemin absolu, sans shell,
 * dans la copie de travail `analyste/*`, et seulement pour ces quatre scripts fermés.
 */

export const CHECKS = ['typecheck', 'lint', 'prettier', 'test'] as const
export type CheckName = (typeof CHECKS)[number]

const SCRIPT_ARGS: Readonly<Record<CheckName, readonly string[]>> = {
  typecheck: ['run', 'typecheck'],
  lint: ['run', 'lint'],
  prettier: ['exec', '--', 'prettier', '--check', 'src', 'tests'],
  test: ['test']
}

export const CHECK_TIMEOUT_MS = 10 * 60_000
/** Lignes gardées de la sortie d'une vérification en échec. */
export const TAIL_LINES = 50

export interface NpmProgram {
  readonly node: string
  readonly npmCli: string
}

export interface CheckResult {
  readonly ok: boolean
  /** Fin de la sortie (≤ 50 lignes), seulement en cas d'échec. */
  readonly tail: string
}

const isFile = (path: string): boolean => existsSync(path) && statSync(path).isFile()

/** `node` et `npm-cli.js` trouvés dans les dossiers ABSOLUS du PATH ; `null` si l'un manque. */
export function resolveNpm(path = process.env['PATH'] ?? ''): NpmProgram | null {
  const windows = process.platform === 'win32'
  let node: string | null = null
  let npmCli: string | null = null
  for (const dir of path.split(delimiter)) {
    const clean = dir.trim().replace(/^"|"$/g, '')
    if (clean === '' || !isAbsolute(clean)) continue
    const nodeCandidate = join(clean, windows ? 'node.exe' : 'node')
    if (node === null && isFile(nodeCandidate)) node = nodeCandidate
    const npmCommand = join(clean, windows ? 'npm.cmd' : 'npm')
    if (npmCli === null && isFile(npmCommand)) {
      // `npm-cli.js` est installé à côté de `npm.cmd` (Windows) ou dans `../lib/node_modules` (Unix).
      const candidates = [
        join(clean, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
        join(dirname(clean), 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')
      ]
      npmCli = candidates.find(isFile) ?? null
    }
  }
  return node === null || npmCli === null ? null : { node, npmCli }
}

export function checkArgs(program: NpmProgram, check: CheckName): string[] {
  return [program.npmCli, ...SCRIPT_ARGS[check]]
}

export type CheckRunner = (cwd: string, check: CheckName, signal: AbortSignal) => Promise<CheckResult>

/** Lance une vérification dans `cwd` : code 0 = réussie ; sortie bornée, aucun interpréteur intermédiaire. */
export function createCheckRunner(program: NpmProgram, timeoutMs = CHECK_TIMEOUT_MS): CheckRunner {
  return (cwd, check, signal) =>
    new Promise((resolve) => {
      let output = ''
      let done = false
      const child = spawn(program.node, checkArgs(program, check), {
        cwd,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, CI: '1', FORCE_COLOR: '0' }
      })
      const collect = (chunk: Buffer): void => {
        output = (output + chunk.toString('utf8')).slice(-64_000)
      }
      const finish = (ok: boolean): void => {
        if (done) return
        done = true
        clearTimeout(timer)
        signal.removeEventListener('abort', stop)
        resolve({ ok, tail: ok ? '' : output.split(/\r?\n/).slice(-TAIL_LINES).join('\n').trim() })
      }
      const stop = (): void => {
        child.kill()
        finish(false)
      }
      child.stdout.on('data', collect)
      child.stderr.on('data', collect)
      const timer = setTimeout(stop, timeoutMs)
      signal.addEventListener('abort', stop, { once: true })
      child.on('error', () => finish(false))
      child.on('close', (code) => finish(code === 0))
    })
}
