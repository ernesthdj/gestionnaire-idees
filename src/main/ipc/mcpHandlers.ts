import { z } from 'zod'
import { SELECTION_MAX, type McpStatusView } from '@shared/ipc/mcp'
import type { SelectionStore } from '../application/mcp/SelectionStore'
import { defineRoute, type IpcRoute } from './registry'

export interface McpRouteDeps {
  readonly selection: SelectionStore
  readonly status: () => McpStatusView
  /** Nouveau secret ; les relais connectés sont déconnectés. */
  readonly rotateToken: () => void
}

/**
 * Commande d'enregistrement du pont dans Claude Code (spec 007 research R2) : le relais est lancé par l'exécutable
 * de l'app en mode Node ; seul le dossier du profil lui est donné — le secret, il le lit lui-même.
 */
export function registrationCommand(input: {
  readonly electronPath: string
  readonly relayPath: string
  readonly profileDir: string
}): string {
  return [
    'claude mcp add brainstormer --scope user',
    '-e ELECTRON_RUN_AS_NODE=1',
    `-e "GI_PROFILE_DIR=${input.profileDir}"`,
    `-- "${input.electronPath}" "${input.relayPath}"`
  ].join(' ')
}

/** Canaux du pont MCP (spec 007 US5, FR-006). */
export function createMcpRoutes(deps: McpRouteDeps): IpcRoute[] {
  return [
    defineRoute({
      channel: 'map:selection',
      input: z.strictObject({ ids: z.array(z.uuid()).max(SELECTION_MAX) }),
      handler: async ({ ids }) => {
        deps.selection.set(ids)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'mcp:status',
      input: z.undefined(),
      handler: async () => deps.status()
    }),
    defineRoute({
      channel: 'mcp:rotateToken',
      input: z.undefined(),
      handler: async () => {
        deps.rotateToken()
        return { ok: true }
      }
    })
  ]
}
