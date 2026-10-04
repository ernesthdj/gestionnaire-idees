import type { McpErrorCode } from '@shared/mcp/tools'

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
