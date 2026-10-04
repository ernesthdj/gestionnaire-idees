import { z } from 'zod'
import { MCP_ERROR_CODES } from './tools'

/**
 * Trames du canal relais → main (spec 007 contracts/pipe-and-ipc.md) : une ligne JSON par message.
 * Le main valide chaque trame ; le relais n'est pas de confiance.
 */

export const PROTOCOL_VERSION = 'gi-mcp/1'
/** Taille maximale d'une trame (octets, saut de ligne exclu). */
export const MAX_FRAME_BYTES = 1024 * 1024
/** Délai accordé au relais pour se présenter. */
export const HELLO_TIMEOUT_MS = 2000
export const MAX_CLIENTS = 8

export const HelloFrame = z.strictObject({
  hello: z.literal(PROTOCOL_VERSION),
  token: z.string().regex(/^[0-9a-f]{64}$/)
})
export type HelloFrame = z.infer<typeof HelloFrame>

export const HelloReply = z.union([
  z.strictObject({ ok: z.literal(true) }),
  z.strictObject({ ok: z.literal(false), code: z.literal('SECRET_REFUSE') })
])
export type HelloReply = z.infer<typeof HelloReply>

export const RequestFrame = z.strictObject({
  id: z.number().int().nonnegative(),
  tool: z.string().min(1).max(40),
  args: z.unknown()
})
export type RequestFrame = z.infer<typeof RequestFrame>

export const ToolError = z.strictObject({ code: z.enum(MCP_ERROR_CODES), message: z.string() })
export type ToolError = z.infer<typeof ToolError>

/** Résultat d'un outil : texte compact pour Claude, et données structurées (identifiants créés…). */
export const ToolResult = z.strictObject({ text: z.string(), data: z.record(z.string(), z.unknown()).optional() })
export type ToolResult = z.infer<typeof ToolResult>

export const ResponseFrame = z.union([
  z.strictObject({ id: z.number().int().nonnegative(), ok: z.literal(true), result: ToolResult }),
  z.strictObject({ id: z.number().int().nonnegative(), ok: z.literal(false), error: ToolError })
])
export type ResponseFrame = z.infer<typeof ResponseFrame>
