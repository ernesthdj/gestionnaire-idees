import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import { COMMAND_LIMITS, tailOutput } from '../../domain/finals/commands'

export interface CommandResult {
  /** `null` : arrêté (délai dépassé) ou lancement impossible. */
  readonly exitCode: number | null
  readonly timedOut: boolean
  readonly durationMs: number
  readonly output: string
}

/** Mémoire gardée pendant le lancement : la fin seulement (la sortie rendue est encore réduite ensuite). */
const BUFFER_MAX = 200_000

/** `node.exe` et `npm-cli.js` d'une installation de Node trouvée dans le PATH ; `null` si absente. */
export function resolveNpm(path = process.env['PATH'] ?? ''): { readonly node: string; readonly cli: string } | null {
  const exe = process.platform === 'win32' ? 'node.exe' : 'node'
  for (const dir of path.split(delimiter)) {
    if (dir.trim() === '') continue
    const node = join(dir, exe)
    const cli = join(dirname(node), 'node_modules', 'npm', 'bin', 'npm-cli.js')
    if (existsSync(node) && existsSync(cli)) return { node, cli }
  }
  return null
}

/** Arrête un processus et tous ses descendants (workers de tests, compilateurs). */
function killTree(pid: number): void {
  if (process.platform === 'win32') {
    // Arguments fixes, aucun interpréteur : seul le numéro de processus varie.
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' })
    return
  }
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    // Déjà terminé.
  }
}

/**
 * Lance un programme résolu par le main (spec 013 R9) : JAMAIS de shell, arguments fixes, dossier imposé, délai
 * maximal au-delà duquel l'arbre de processus est arrêté ; sortie (stdout + stderr) bornée et sans couleurs.
 */
export function runCommand(input: {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly timeoutMs?: number
}): Promise<CommandResult> {
  const started = Date.now()
  return new Promise((resolve) => {
    let output = ''
    let timedOut = false
    let done = false
    const finish = (exitCode: number | null): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ exitCode, timedOut, durationMs: Date.now() - started, output: tailOutput(output) })
    }
    const child = spawn(input.command, [...input.args], {
      cwd: input.cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' }
    })
    const collect = (chunk: Buffer): void => {
      output += chunk.toString('utf8')
      if (output.length > BUFFER_MAX) output = output.slice(-BUFFER_MAX)
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    const timer = setTimeout(() => {
      timedOut = true
      if (child.pid !== undefined) killTree(child.pid)
    }, input.timeoutMs ?? COMMAND_LIMITS.timeoutMs)
    child.on('error', (error) => {
      output += `\nLancement impossible : ${error.message}`
      finish(null)
    })
    child.on('close', (code) => finish(timedOut ? null : code))
  })
}
