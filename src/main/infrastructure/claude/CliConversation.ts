import { spawn } from 'node:child_process'

/** Processus d'une conversation tel que le service le pilote (remplaçable par un faux dans les tests). */
export interface ConversationProcess {
  /** Écrit une ligne sur l'entrée standard (un message `stream-json`). */
  write(line: string): void
  kill(): void
}

export interface SpawnOptions {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly onLine: (line: string) => void
  /** Fin du processus ; `stderr` : dernières lignes d'erreur (jamais journalisées). */
  readonly onExit: (code: number | null, stderr: string) => void
}

export type SpawnConversation = (options: SpawnOptions) => ConversationProcess

const STDERR_KEEP = 4000

/**
 * Lance `claude` en flux continu (spec 008 research R1) : arguments fixes fournis par le service, aucun interpréteur
 * de commandes (`shell: false`), texte de mentalyas par l'entrée standard uniquement.
 */
export const spawnClaudeConversation: SpawnConversation = (options) => {
  const child = spawn(options.command, [...options.args], {
    cwd: options.cwd,
    shell: false,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    // Une demande de permission attend mentalyas jusqu'à 30 min (spec 014 R1) : Claude Code attend 32 min un outil MCP.
    env: { ...process.env, MCP_TOOL_TIMEOUT: '1920000' }
  })
  let buffer = ''
  let stderr = ''
  let ended = false
  // `error` (lancement impossible) et `close` peuvent se suivre : une seule fin est annoncée.
  const end = (code: number | null): void => {
    if (ended) return
    ended = true
    if (buffer.trim() !== '') options.onLine(buffer)
    options.onExit(code, stderr)
  }
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) if (line.trim() !== '') options.onLine(line)
  })
  child.stderr.on('data', (chunk: string) => {
    stderr = (stderr + chunk).slice(-STDERR_KEEP)
  })
  child.on('error', () => end(null))
  child.on('close', (code) => end(code))
  child.stdin.on('error', () => undefined)
  return {
    write: (line) => {
      if (!child.stdin.destroyed) child.stdin.write(`${line}\n`)
    },
    kill: () => {
      if (child.exitCode === null) child.kill()
    }
  }
}
