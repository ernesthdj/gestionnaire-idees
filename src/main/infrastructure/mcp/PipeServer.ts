import { createServer, type Server, type Socket } from 'node:net'
import { z } from 'zod'
import {
  HELLO_TIMEOUT_MS,
  HelloFrame,
  MAX_CLIENTS,
  RequestFrame,
  type HelloReply,
  type ResponseFrame,
  type ToolResult
} from '@shared/mcp/protocol'
import { isMcpToolName, MCP_TOOLS, type McpErrorCode, type McpToolName } from '@shared/mcp/tools'
import type { McpCaller } from '../../domain/mcp/caller'
import { McpToolError } from '../../domain/mcp/errors'
import type { Logger } from '../logging/logger'
import { LineSplitter } from './lineSplitter'

/** Exécute un outil dont l'entrée a déjà été validée par son schéma. */
export type McpToolHandler = (tool: McpToolName, args: unknown, caller: McpCaller) => ToolResult

export interface PipeServerOptions {
  readonly pipeName: string
  readonly matchesToken: (candidate: string) => boolean
  readonly handle: McpToolHandler
  readonly logger: Logger
  readonly maxClients?: number
  readonly helloTimeoutMs?: number
}

/** Message lisible d'une entrée refusée : chemin du champ et raison (FR-008). */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.length === 0 ? '(racine)' : issue.path.join('.')} : ${issue.message}`)
    .join(' ; ')
}

/**
 * Serveur du canal nommé (spec 007 research R1, R4) : seul point d'entrée externe de l'app. Chaque connexion se
 * présente avec le secret ; ensuite, une requête par ligne, exécutée de façon synchrone (le main sérialise donc les
 * écritures de tous les clients). Toute trame malformée ou trop grande ferme la connexion.
 */
export class PipeServer {
  private server: Server | undefined
  private readonly sockets = new Set<Socket>()

  constructor(private readonly options: PipeServerOptions) {}

  start(): Promise<void> {
    const server = createServer((socket) => this.accept(socket))
    this.server = server
    return new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(this.options.pipeName, () => {
        server.off('error', reject)
        server.on('error', () => this.options.logger.error('mcp.server_error', {}))
        resolve()
      })
    })
  }

  stop(): Promise<void> {
    this.disconnectAll()
    const server = this.server
    this.server = undefined
    return new Promise((resolve) => (server === undefined ? resolve() : server.close(() => resolve())))
  }

  clients(): number {
    return this.sockets.size
  }

  listening(): boolean {
    return this.server?.listening ?? false
  }

  /** Après une rotation du secret : chaque relais devra se représenter. */
  disconnectAll(): void {
    for (const socket of this.sockets) socket.destroy()
    this.sockets.clear()
  }

  private accept(socket: Socket): void {
    const maxClients = this.options.maxClients ?? MAX_CLIENTS
    if (this.sockets.size >= maxClients) {
      socket.destroy()
      return
    }
    this.sockets.add(socket)
    socket.setEncoding('utf8')
    socket.on('close', () => this.sockets.delete(socket))
    socket.on('error', () => socket.destroy())

    let authenticated = false
    let caller: McpCaller = { neuronId: null }
    const splitter = new LineSplitter()
    const timer = setTimeout(() => {
      if (!authenticated) socket.destroy()
    }, this.options.helloTimeoutMs ?? HELLO_TIMEOUT_MS)

    socket.on('data', (chunk: string) => {
      const { lines, overflow } = splitter.push(chunk)
      if (overflow) {
        socket.destroy()
        return
      }
      for (const line of lines) {
        if (socket.destroyed) return
        const frame = parseJson(line)
        if (!authenticated) {
          const hello = HelloFrame.safeParse(frame)
          clearTimeout(timer)
          if (!hello.success || !this.options.matchesToken(hello.data.token)) {
            this.options.logger.warn('mcp.refused', {})
            socket.end(`${JSON.stringify({ ok: false, code: 'SECRET_REFUSE' } satisfies HelloReply)}\n`)
            return
          }
          authenticated = true
          caller = { neuronId: hello.data.neuron ?? null }
          socket.write(`${JSON.stringify({ ok: true } satisfies HelloReply)}\n`)
          continue
        }
        const request = RequestFrame.safeParse(frame)
        if (!request.success) {
          socket.destroy()
          return
        }
        socket.write(`${JSON.stringify(this.run(request.data.id, request.data.tool, request.data.args, caller))}\n`)
      }
    })
  }

  private run(id: number, tool: string, args: unknown, caller: McpCaller): ResponseFrame {
    const started = Date.now()
    const fail = (code: McpErrorCode, message: string): ResponseFrame => {
      this.options.logger.info('mcp.call', { kind: tool, status: code, durationMs: Date.now() - started })
      return { id, ok: false, error: { code, message } }
    }
    if (!isMcpToolName(tool)) return fail('ENTREE_INVALIDE', `Outil inconnu : ${tool.slice(0, 40)}`)
    const parsed = MCP_TOOLS[tool].input.safeParse(args)
    if (!parsed.success) return fail('ENTREE_INVALIDE', describeIssues(parsed.error))
    try {
      const result = this.options.handle(tool, parsed.data, caller)
      this.options.logger.info('mcp.call', { kind: tool, status: 'ok', durationMs: Date.now() - started })
      return { id, ok: true, result }
    } catch (error) {
      if (error instanceof McpToolError) return fail(error.code, error.message)
      this.options.logger.error('mcp.call_failed', { kind: tool })
      return fail('ERREUR_INTERNE', 'Erreur interne du Brainstormer.')
    }
  }
}

function parseJson(line: string): unknown {
  try {
    return JSON.parse(line)
  } catch {
    return undefined
  }
}
