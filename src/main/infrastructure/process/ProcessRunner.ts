import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { delimiter, isAbsolute, join } from 'node:path'

/**
 * Exécuteur de processus commun (spec 021 research R1) : sans shell, fenêtre cachée, environnement fourni, entrée
 * standard facultative, annulation, délai, **sorties bornées** (au-delà : `truncated`), sortie d'erreur suivie ligne à
 * ligne (progression). Sert à git (`GitRunner`, `runGit`) et à `gh`.
 */

export interface ProcessRequest {
  /** Chemin ABSOLU du programme (`resolveProgram`). */
  readonly program: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly env: Readonly<Record<string, string>>
  readonly stdin?: string
  readonly signal?: AbortSignal
  readonly timeoutMs: number
  /** Taille maximale gardée de chaque sortie (8 Mo au plus). */
  readonly maxOutput?: number
  /** Chaque morceau de la sortie d'erreur (progression de git). */
  readonly onStderr?: (text: string) => void
}

export interface ProcessResult {
  /** `null` : arrêté (annulation, délai) ou jamais lancé. */
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
  /** Une sortie a dépassé `maxOutput` : le début est gardé, la suite perdue. */
  readonly truncated: boolean
  readonly timedOut: boolean
  /** Le programme n'a pas pu être lancé. */
  readonly spawnFailed: boolean
}

export type RunProcess = (request: ProcessRequest) => Promise<ProcessResult>

export const MAX_OUTPUT = 8 * 1024 * 1024

export const runProcess: RunProcess = (request) =>
  new Promise((resolve) => {
    const limit = Math.min(request.maxOutput ?? MAX_OUTPUT, MAX_OUTPUT)
    if (request.signal?.aborted === true) {
      resolve({ code: null, stdout: '', stderr: '', truncated: false, timedOut: false, spawnFailed: false })
      return
    }
    const out: Buffer[] = []
    const err: Buffer[] = []
    let outSize = 0
    let errSize = 0
    let truncated = false
    let timedOut = false
    let settled = false
    const child = spawn(request.program, [...request.args], {
      cwd: request.cwd,
      env: { ...request.env },
      shell: false,
      windowsHide: true,
      stdio: [request.stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe']
    })
    const keep = (chunks: Buffer[], size: number, chunk: Buffer): number => {
      if (size >= limit) {
        truncated = true
        return size
      }
      const part = size + chunk.length > limit ? chunk.subarray(0, limit - size) : chunk
      if (part.length < chunk.length) truncated = true
      chunks.push(part)
      return size + part.length
    }
    const abort = (): void => stopTree(child)
    const timer = setTimeout(() => {
      timedOut = true
      stopTree(child)
    }, request.timeoutMs)
    const finish = (code: number | null, spawnFailed: boolean): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      request.signal?.removeEventListener('abort', abort)
      resolve({
        code: request.signal?.aborted === true || timedOut ? null : code,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
        truncated,
        timedOut,
        spawnFailed
      })
    }
    request.signal?.addEventListener('abort', abort, { once: true })
    child.stdout?.on('data', (chunk: Buffer) => {
      outSize = keep(out, outSize, chunk)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      errSize = keep(err, errSize, chunk)
      request.onStderr?.(chunk.toString('utf8'))
    })
    if (request.stdin !== undefined && child.stdin !== null) {
      child.stdin.on('error', () => undefined)
      child.stdin.end(request.stdin, 'utf8')
    }
    child.on('error', () => finish(null, child.pid === undefined))
    child.on('close', (code) => finish(code, false))
  })

/**
 * Chemin absolu d'un programme trouvé dans les dossiers ABSOLUS du PATH ; `null` s'il est absent. Sous Windows, lancer
 * un programme par son seul nom chercherait d'abord dans le dossier courant — celui du projet, où un `git.exe` piégé
 * pourrait attendre.
 */
export function resolveProgram(name: string, path = process.env['PATH'] ?? ''): string | null {
  const exe = process.platform === 'win32' ? `${name}.exe` : name
  for (const dir of path.split(delimiter)) {
    const clean = dir.trim().replace(/^"|"$/g, '')
    if (clean === '' || !isAbsolute(clean)) continue
    const candidate = join(clean, exe)
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

/**
 * Arrête un processus ET ses sous-processus (`git-remote-https`, `index-pack`) : sous Windows, `kill` n'arrêterait que
 * le parent et les enfants garderaient des fichiers ouverts.
 */
export function stopTree(child: ChildProcess): void {
  if (child.exitCode !== null || child.pid === undefined) return
  const systemRoot = process.env['SystemRoot'] ?? ''
  if (process.platform !== 'win32' || !isAbsolute(systemRoot)) {
    child.kill()
    return
  }
  const killer = spawn(join(systemRoot, 'System32', 'taskkill.exe'), ['/pid', String(child.pid), '/T', '/F'], {
    shell: false,
    windowsHide: true,
    stdio: 'ignore'
  })
  killer.on('error', () => child.kill())
}
