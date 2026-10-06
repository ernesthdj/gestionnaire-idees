import { z } from 'zod'
import { CODE_CATEGORIES, CODE_LANGS } from '@shared/ipc/reprise'
import type { ExplorerService } from '../application/reprise/ExplorerService'
import { defineRoute, type IpcRoute } from './registry'

/** Clé de nœud de l'explorateur : `m:`, `d:`, `f:` (chemins relatifs) ou `s:` (symbole) ; `''` = racine. */
const NodeKey = z
  .string()
  .max(2000)
  .refine((key) => key === '' || /^[mdfs]:/.test(key), 'clé de nœud')
const Filters = z.strictObject({
  categories: z.array(z.enum(CODE_CATEGORIES)).max(4),
  langs: z.array(z.enum(CODE_LANGS)).max(6),
  hideUncertain: z.boolean()
})
const Coordinate = z.number().finite().min(-1_000_000).max(1_000_000)
const SymbolId = z.string().regex(/^[0-9a-f]{32}$/)

/** Canaux `explorer:*` (spec 017 contracts) : lectures du graphe d'un projet repris, positions et filtres retenus. */
export function createExplorerRoutes(
  explorer: Pick<ExplorerService, 'view' | 'node' | 'code' | 'search' | 'savePosition' | 'state' | 'saveState'>
): IpcRoute[] {
  return [
    defineRoute({
      channel: 'explorer:view',
      input: z.strictObject({
        genesisId: z.uuid(),
        parentKey: NodeKey,
        filters: Filters,
        focusKey: NodeKey.optional(),
        depth: z.union([z.literal(1), z.literal(2)]).optional()
      }),
      handler: async ({ genesisId, ...input }) => explorer.view(genesisId, input)
    }),
    defineRoute({
      channel: 'explorer:node',
      input: z.strictObject({ genesisId: z.uuid(), nodeKey: NodeKey }),
      handler: async ({ genesisId, nodeKey }) => explorer.node(genesisId, nodeKey)
    }),
    defineRoute({
      channel: 'explorer:code',
      input: z.strictObject({ genesisId: z.uuid(), symbolId: SymbolId }),
      handler: async ({ genesisId, symbolId }) => explorer.code(genesisId, symbolId)
    }),
    defineRoute({
      channel: 'explorer:search',
      input: z.strictObject({ genesisId: z.uuid(), query: z.string().trim().min(2).max(100) }),
      handler: async ({ genesisId, query }) => explorer.search(genesisId, query)
    }),
    defineRoute({
      channel: 'explorer:savePosition',
      input: z.strictObject({
        genesisId: z.uuid(),
        parentKey: NodeKey,
        nodeKey: NodeKey,
        x: Coordinate,
        y: Coordinate
      }),
      handler: async ({ genesisId, ...input }) => {
        explorer.savePosition(genesisId, input)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'explorer:state',
      input: z.strictObject({ genesisId: z.uuid() }),
      handler: async ({ genesisId }) => explorer.state(genesisId)
    }),
    defineRoute({
      channel: 'explorer:saveState',
      input: z.strictObject({ genesisId: z.uuid(), parentKey: NodeKey, filters: Filters }),
      handler: async ({ genesisId, ...input }) => {
        explorer.saveState(genesisId, input)
        return { ok: true }
      }
    })
  ]
}
