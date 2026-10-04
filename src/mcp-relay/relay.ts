import { connect, type Socket } from 'node:net'
import { join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { HelloReply, PROTOCOL_VERSION, ResponseFrame, type ToolResult } from '@shared/mcp/protocol'
import { MCP_INSTRUCTIONS, MCP_TOOL_NAMES, MCP_TOOLS, type McpErrorCode } from '@shared/mcp/tools'
import { pipeNameFor, tokenPathFor } from '../main/infrastructure/mcp/endpoint'
import { LineSplitter } from '../main/infrastructure/mcp/lineSplitter'
import { readToken } from '../main/infrastructure/mcp/token'

/**
 * Relais du pont MCP (spec 007 research R1, R2) : lancé par Claude Code (`electron.exe` avec ELECTRON_RUN_AS_NODE=1),
 * il est le serveur MCP (stdio) et transmet chaque appel d'outil au main par le canal nommé du profil. Il ne touche
 * jamais la base ; le main revalide tout. App fermée : chaque outil répond « pas lancé », la session MCP survit et se
 * reconnecte à l'appel suivant.
 */

const CALL_TIMEOUT_MS = 30_000

const APP_CLOSED = 'Le Brainstormer n’est pas lancé — demande à mentalyas de l’ouvrir, puis réessaie.'
const SECRET_REFUSED =
  'Le secret du pont a été refusé : réenregistre le pont depuis Réglages › Claude Code du Brainstormer.'

class RelayFailure extends Error {
  constructor(
    readonly code: McpErrorCode,
    message: string
  ) {
    super(message)
  }
}

interface Pending {
  readonly resolve: (frame: ResponseFrame) => void
  readonly reject: (error: RelayFailure) => void
  readonly timer: NodeJS.Timeout
}

/** Connexion paresseuse au main : établie au premier appel, rétablie après une fermeture de l'app. */
class PipeClient {
  private socket: Socket | undefined
  private ready: Promise<Socket> | undefined
  private nextId = 1
  private readonly pending = new Map<number, Pending>()

  constructor(
    private readonly pipeName: string,
    private readonly tokenFile: string
  ) {}

  async call(tool: string, args: unknown): Promise<ToolResult> {
    const socket = await this.connected()
    const id = this.nextId++
    const frame = await new Promise<ResponseFrame>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new RelayFailure('ERREUR_INTERNE', 'Le Brainstormer ne répond pas.'))
      }, CALL_TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
      socket.write(`${JSON.stringify({ id, tool, args })}\n`)
    })
    if (!frame.ok) throw new RelayFailure(frame.error.code, frame.error.message)
    return frame.result
  }

  private connected(): Promise<Socket> {
    if (this.socket !== undefined && !this.socket.destroyed) return Promise.resolve(this.socket)
    this.ready ??= this.open().finally(() => (this.ready = undefined))
    return this.ready
  }

  private open(): Promise<Socket> {
    // Relu à chaque connexion : une rotation du secret dans l'app est prise en compte sans relancer Claude Code.
    const token = readToken(this.tokenFile)
    if (token === undefined) return Promise.reject(new RelayFailure('APP_FERMEE', APP_CLOSED))
    return new Promise((resolve, reject) => {
      const socket = connect(this.pipeName)
      const splitter = new LineSplitter()
      let greeted = false
      socket.setEncoding('utf8')
      socket.once('error', () => {
        if (!greeted) reject(new RelayFailure('APP_FERMEE', APP_CLOSED))
      })
      socket.on('close', () => {
        if (!greeted) reject(new RelayFailure('APP_FERMEE', APP_CLOSED))
        this.failAll(new RelayFailure('APP_FERMEE', APP_CLOSED))
        if (this.socket === socket) this.socket = undefined
      })
      socket.on('connect', () => socket.write(`${JSON.stringify({ hello: PROTOCOL_VERSION, token })}\n`))
      socket.on('data', (chunk: string) => {
        const { lines, overflow } = splitter.push(chunk)
        if (overflow) {
          socket.destroy()
          return
        }
        for (const line of lines) {
          const value = safeJson(line)
          if (!greeted) {
            const reply = HelloReply.safeParse(value)
            if (!reply.success || !reply.data.ok) {
              socket.destroy()
              reject(new RelayFailure('SECRET_REFUSE', SECRET_REFUSED))
              return
            }
            greeted = true
            this.socket = socket
            resolve(socket)
            continue
          }
          const frame = ResponseFrame.safeParse(value)
          if (!frame.success) continue
          const waiting = this.pending.get(frame.data.id)
          if (waiting === undefined) continue
          clearTimeout(waiting.timer)
          this.pending.delete(frame.data.id)
          waiting.resolve(frame.data)
        }
      })
    })
  }

  private failAll(error: RelayFailure): void {
    for (const [id, waiting] of this.pending) {
      clearTimeout(waiting.timer)
      waiting.reject(error)
      this.pending.delete(id)
    }
  }
}

function safeJson(line: string): unknown {
  try {
    return JSON.parse(line)
  } catch {
    return undefined
  }
}

function profileDir(): string {
  const fromEnv = process.env['GI_PROFILE_DIR']
  if (fromEnv !== undefined && fromEnv.trim() !== '') return fromEnv
  return join(process.env['APPDATA'] ?? '', 'gestionnaire-idees')
}

async function main(): Promise<void> {
  const profile = profileDir()
  const client = new PipeClient(pipeNameFor(profile), tokenPathFor(profile))
  const server = new McpServer({ name: 'brainstormer', version: '1.0.0' }, { instructions: MCP_INSTRUCTIONS })

  for (const name of MCP_TOOL_NAMES) {
    const tool = MCP_TOOLS[name]
    server.registerTool(name, { description: tool.description, inputSchema: tool.input }, async (args: unknown) => {
      try {
        const result = await client.call(name, args)
        return { content: [{ type: 'text' as const, text: result.text }] }
      } catch (error) {
        const message = error instanceof RelayFailure ? error.message : 'Erreur inattendue du relais.'
        return { content: [{ type: 'text' as const, text: message }], isError: true }
      }
    })
  }

  await server.connect(new StdioServerTransport())
}

void main()
