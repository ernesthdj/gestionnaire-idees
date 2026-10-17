import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { delimiter, dirname, isAbsolute, join } from 'node:path'
import { parseCheckCommand } from '@shared/agents/checks'
import type { CheckRun } from '@shared/agents/pipeline'
import { resolveNpm } from '../analyste/NpmCli'

/**
 * Lance les commandes de vérification validées par mentalyas (L2-pipeline-optimal D2, T002) dans le worktree d'un
 * agent : jamais de shell, un programme par chemin absolu et ses arguments. `npm` et `npx` passent par `node` avec leur
 * script installé à côté de `npm.cmd` (un `.cmd` ne se lance pas sans shell) ; les autres programmes sont cherchés dans
 * les dossiers absolus du PATH. Délai et sortie bornés.
 */

export const CHECK_RUN_TIMEOUT_MS = 10 * 60_000
/** Lignes gardées de la sortie d'une commande en échec. */
export const CHECK_TAIL_LINES = 50
const OUTPUT_MAX = 64_000
/** Attente de la fermeture d'une commande arrêtée. */
const KILL_GRACE_MS = 5_000

const isFile = (path: string): boolean => existsSync(path) && statSync(path).isFile()

/** Programme et arguments à lancer, ou la raison pour laquelle la commande ne peut pas l'être. */
export function resolveCheck(
  command: string,
  path = process.env['PATH'] ?? ''
): { readonly file: string; readonly args: readonly string[] } | { readonly error: string } {
  const parsed = parseCheckCommand(command)
  if (!parsed.ok) return { error: parsed.reason }
  const { program, args } = parsed
  if (program.includes('/') || program.includes('\\')) return { error: 'un programme se nomme, sans chemin' }
  const name = program.toLowerCase()
  if (name === 'npm' || name === 'npx' || name === 'node') {
    const npm = resolveNpm(path)
    if (npm === null) return { error: 'node ou npm introuvable dans le PATH' }
    if (name === 'node') return { file: npm.node, args }
    if (name === 'npm') return { file: npm.node, args: [npm.npmCli, ...args] }
    const npxCli = join(dirname(npm.npmCli), 'npx-cli.js')
    return isFile(npxCli) ? { file: npm.node, args: [npxCli, ...args] } : { error: 'npx introuvable à côté de npm' }
  }
  const windows = process.platform === 'win32'
  for (const dir of path.split(delimiter)) {
    const clean = dir.trim().replace(/^"|"$/g, '')
    if (clean === '' || !isAbsolute(clean)) continue
    const candidate = join(clean, windows ? `${program}.exe` : program)
    if (isFile(candidate)) return { file: candidate, args }
  }
  return {
    error: windows
      ? `« ${program} » introuvable en .exe dans le PATH (un script .cmd ne se lance pas sans shell : passe par « npm run … »)`
      : `« ${program} » introuvable dans le PATH`
  }
}

/** Lance une commande dans `cwd` : code 0 = verte. N'échoue jamais : une erreur devient un résultat rouge. */
export function runCheckCommand(
  cwd: string,
  command: string,
  signal?: AbortSignal,
  timeoutMs = CHECK_RUN_TIMEOUT_MS
): Promise<CheckRun> {
  const started = Date.now()
  const resolved = resolveCheck(command)
  if ('error' in resolved) {
    return Promise.resolve({ command, ok: false, exitCode: null, tail: resolved.error, durationMs: 0 })
  }
  return new Promise((resolve) => {
    let output = ''
    let done = false
    const child = spawn(resolved.file, [...resolved.args], {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: '1', FORCE_COLOR: '0' }
    })
    const collect = (chunk: Buffer): void => {
      output = (output + chunk.toString('utf8')).slice(-OUTPUT_MAX)
    }
    const finish = (exitCode: number | null, note?: string): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', stop)
      const ok = exitCode === 0
      const tail = ok
        ? ''
        : [note, output.split(/\r?\n/).slice(-CHECK_TAIL_LINES).join('\n').trim()].filter((t) => t).join('\n')
      resolve({ command, ok, exitCode, tail, durationMs: Date.now() - started })
    }
    // Arrêtée : on attend que le processus soit vraiment fermé (sous Windows, il tient son dossier un instant, et le
    // worktree qui suit ne se supprimerait pas) ; 5 s au plus.
    let stopped: string | undefined
    const stop = (): void => {
      stopped = signal?.aborted === true ? 'arrêtée (assemblage annulé)' : 'arrêtée : délai dépassé'
      child.kill()
      setTimeout(() => finish(null, stopped), KILL_GRACE_MS).unref()
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    const timer = setTimeout(stop, timeoutMs)
    signal?.addEventListener('abort', stop, { once: true })
    child.on('error', (error) => finish(null, `lancement impossible : ${error.message}`))
    child.on('close', (code) => finish(stopped === undefined ? code : null, stopped))
  })
}
