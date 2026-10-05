import type { McpErrorCode } from '@shared/mcp/tools'
import { AppError } from '../errors'

/** Erreur attendue d'un outil du pont MCP : son code et son message sont renvoyés tels quels à Claude (spec 007). */
export class McpToolError extends Error {
  constructor(
    readonly code: McpErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'McpToolError'
  }
}

/** Codes d'erreur métier (`AppError`) traduits pour Claude ; les autres deviennent une erreur interne. */
const APP_TO_MCP: Readonly<Record<string, McpErrorCode>> = {
  NOT_FOUND: 'INTROUVABLE',
  VALIDATION: 'LOT_INVALIDE',
  LOCKED: 'NON_MODIFIABLE',
  INVALID_STATE: 'NON_MODIFIABLE',
  DUPLICATE: 'DEJA_RELIES'
}

/** Erreur d'un service appelé par un outil du pont → erreur MCP avec son message, si elle est attendue. */
export function toMcpError(error: unknown): McpToolError | undefined {
  if (error instanceof McpToolError) return error
  if (error instanceof AppError) {
    const code = APP_TO_MCP[error.code]
    return code === undefined ? undefined : new McpToolError(code, error.message)
  }
  return undefined
}
