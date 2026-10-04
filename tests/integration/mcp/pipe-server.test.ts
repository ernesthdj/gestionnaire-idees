import { randomUUID } from 'node:crypto'
import { connect, type Socket } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { McpToolError } from '../../../src/main/domain/mcp/errors'
import { PipeServer } from '../../../src/main/infrastructure/mcp/PipeServer'
import type { LogRecord } from '../../../src/main/infrastructure/logging/logger'
import { createLogger } from '../../../src/main/infrastructure/logging/logger'

const TOKEN = 'a'.repeat(64)

/** Client minimal du canal : lit les lignes reçues, signale la fermeture. */
class TestClient {
  readonly lines: unknown[] = []
  closed = false
  private buffer = ''
  private readonly waiters: Array<() => void> = []

  constructor(readonly socket: Socket) {
    socket.setEncoding('utf8')
    socket.on('data', (chunk: string) => {
      this.buffer += chunk
      const parts = this.buffer.split('\n')
      this.buffer = parts.pop() ?? ''
      for (const part of parts) if (part !== '') this.lines.push(JSON.parse(part))
      this.flush()
    })
    socket.on('close', () => {
      this.closed = true
      this.flush()
    })
    socket.on('error', () => undefined)
  }

  send(value: unknown): void {
    this.socket.write(`${typeof value === 'string' ? value : JSON.stringify(value)}\n`)
  }

  /** Attend `count` lignes reçues ou la fermeture. */
  async until(count: number): Promise<void> {
    while (this.lines.length < count && !this.closed) await new Promise<void>((resolve) => this.waiters.push(resolve))
  }

  async untilClosed(): Promise<void> {
    while (!this.closed) await new Promise<void>((resolve) => this.waiters.push(resolve))
  }

  private flush(): void {
    for (const resolve of this.waiters.splice(0)) resolve()
  }
}

describe('canal du pont MCP', () => {
  let pipeName: string
  let server: PipeServer
  let records: LogRecord[]
  const calls: string[] = []

  const open = (): Promise<TestClient> =>
    new Promise((resolve, reject) => {
      const socket = connect(pipeName, () => resolve(new TestClient(socket)))
      socket.once('error', reject)
    })

  const authenticated = async (): Promise<TestClient> => {
    const client = await open()
    client.send({ hello: 'gi-mcp/1', token: TOKEN })
    await client.until(1)
    return client
  }

  beforeEach(async () => {
    pipeName = `\\\\.\\pipe\\gi-mcp-test-${randomUUID()}`
    records = []
    calls.length = 0
    server = new PipeServer({
      pipeName,
      matchesToken: (candidate) => candidate === TOKEN,
      logger: createLogger((record) => records.push(record)),
      maxClients: 2,
      helloTimeoutMs: 200,
      handle: (tool, args) => {
        calls.push(tool)
        if (tool === 'noeud_lire') throw new McpToolError('INTROUVABLE', 'Élément introuvable')
        if (tool === 'retirer') throw new Error('panne secrète contenu-privé')
        return { text: `ok ${tool} ${JSON.stringify(args)}` }
      }
    })
    await server.start()
  })

  afterEach(() => server.stop())

  it('should_answer_a_tool_call_when_the_secret_is_right', async () => {
    const client = await authenticated()
    expect(client.lines[0]).toEqual({ ok: true })
    client.send({ id: 1, tool: 'etat', args: {} })
    await client.until(2)
    expect(client.lines[1]).toEqual({ id: 1, ok: true, result: { text: 'ok etat {}' } })
  })

  it('should_refuse_and_close_when_the_secret_is_wrong', async () => {
    const client = await open()
    client.send({ hello: 'gi-mcp/1', token: 'b'.repeat(64) })
    await client.untilClosed()
    expect(client.lines).toEqual([{ ok: false, code: 'SECRET_REFUSE' }])
    expect(calls).toEqual([])
  })

  it('should_close_when_no_hello_arrives_in_time', async () => {
    const client = await open()
    await client.untilClosed()
    expect(client.lines).toEqual([])
  })

  it('should_close_on_a_frame_over_the_size_limit_or_an_invalid_request', async () => {
    const big = await authenticated()
    big.send('x'.repeat(1024 * 1024 + 10))
    await big.untilClosed()
    const invalid = await authenticated()
    invalid.send('pas du json')
    await invalid.untilClosed()
    expect(calls).toEqual([])
  })

  it('should_reject_an_unknown_tool_and_an_invalid_input_without_calling_the_handler', async () => {
    const client = await authenticated()
    client.send({ id: 1, tool: 'effacer_tout', args: {} })
    client.send({ id: 2, tool: 'dessiner', args: { noeuds: [] } })
    await client.until(3)
    expect(client.lines[1]).toMatchObject({ id: 1, ok: false, error: { code: 'ENTREE_INVALIDE' } })
    expect(client.lines[2]).toMatchObject({ id: 2, ok: false, error: { code: 'ENTREE_INVALIDE' } })
    expect(calls).toEqual([])
  })

  it('should_return_tool_errors_and_hide_internal_ones', async () => {
    const client = await authenticated()
    client.send({ id: 1, tool: 'noeud_lire', args: { id: randomUUID() } })
    client.send({ id: 2, tool: 'retirer', args: { ids: [randomUUID()] } })
    await client.until(3)
    expect(client.lines[1]).toEqual({
      id: 1,
      ok: false,
      error: { code: 'INTROUVABLE', message: 'Élément introuvable' }
    })
    expect(client.lines[2]).toEqual({
      id: 2,
      ok: false,
      error: { code: 'ERREUR_INTERNE', message: 'Erreur interne du Brainstormer.' }
    })
    expect(JSON.stringify(records)).not.toContain('contenu-privé')
  })

  it('should_serve_requests_in_order', async () => {
    const client = await authenticated()
    for (let id = 1; id <= 5; id++) client.send({ id, tool: 'etat', args: {} })
    await client.until(6)
    expect(client.lines.slice(1).map((line) => (line as { id: number }).id)).toEqual([1, 2, 3, 4, 5])
  })

  it('should_refuse_a_client_beyond_the_limit', async () => {
    await authenticated()
    await authenticated()
    const third = await open()
    await third.untilClosed()
    expect(server.clients()).toBe(2)
  })

  it('should_disconnect_everyone_when_asked', async () => {
    const client = await authenticated()
    server.disconnectAll()
    await client.untilClosed()
    expect(server.clients()).toBe(0)
  })

  it('should_log_tool_status_and_duration_without_any_argument_or_secret', async () => {
    const client = await authenticated()
    client.send({ id: 1, tool: 'etat', args: {} })
    await client.until(2)
    const call = records.find((record) => record.event === 'mcp.call')
    expect(call?.fields).toMatchObject({ kind: 'etat', status: 'ok' })
    expect(JSON.stringify(records)).not.toContain(TOKEN)
  })
})
