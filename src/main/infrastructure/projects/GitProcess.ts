import { spawn } from 'node:child_process'
import { stopTree } from '../process/ProcessRunner'

/**
 * Lanceur git annulable (spec 020 T027, spec 021 R6) : complète `runGit` (`GitCli.ts`) pour les opérations longues —
 * annulation par `AbortSignal`, sortie d'erreur suivie au fil de l'eau (progression), sorties bornées. Sans shell,
 * programme par chemin absolu (résolu par l'appelant), environnement fourni par l'appelant.
 */

export interface GitProcessRequest {
  readonly program: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly env: Readonly<Record<string, string>>
  readonly signal: AbortSignal
  /** Morceaux de la sortie d'erreur (progression de git), dans l'ordre. */
  readonly onStderr?: (text: string) => void
}

export interface GitProcessResult {
  /** `null` : arrêté (annulation, délai) ou jamais lancé. */
  readonly code: number | null
  /** Fins des sorties (bornées) : peuvent contenir une adresse avec identifiant, jamais journalisées telles quelles. */
  readonly stdout: string
  readonly stderr: string
  /** Le programme n'a pas pu être lancé (introuvable, refusé). */
  readonly spawnFailed: boolean
}

export type GitLauncher = (request: GitProcessRequest) => Promise<GitProcessResult>

const OUTPUT_TAIL = 16_000

export const launchGit: GitLauncher = (request) =>
  new Promise((resolve) => {
    if (request.signal.aborted) {
      resolve({ code: null, stdout: '', stderr: '', spawnFailed: false })
      return
    }
    let stdout = ''
    let stderr = ''
    let settled = false
    const child = spawn(request.program, [...request.args], {
      cwd: request.cwd,
      env: { ...request.env },
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const abort = (): void => stopTree(child)
    const finish = (code: number | null, spawnFailed: boolean): void => {
      if (settled) return
      settled = true
      request.signal.removeEventListener('abort', abort)
      resolve({ code: request.signal.aborted ? null : code, stdout, stderr, spawnFailed })
    }
    request.signal.addEventListener('abort', abort, { once: true })
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = (stdout + chunk.toString('utf8')).slice(-OUTPUT_TAIL)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      stderr = (stderr + text).slice(-OUTPUT_TAIL)
      request.onStderr?.(text)
    })
    child.on('error', () => finish(null, child.pid === undefined))
    child.on('close', (code) => finish(code, false))
  })
