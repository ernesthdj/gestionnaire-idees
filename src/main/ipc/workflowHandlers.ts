import { z } from 'zod'
import { ProjectFile } from '@shared/ipc/projectFile'
import { WORKFLOW_KEY } from '@shared/ipc/workflow'
import { AppError } from '../domain/errors'
import type { WorkflowService } from '../application/workflow/WorkflowService'
import type { WorkflowChats } from '../application/workflow/WorkflowChats'
import type { WorkflowSymbols } from '../application/workflow/WorkflowSymbols'
import type { WorkflowFoldRepository } from '../infrastructure/db/repositories/WorkflowFoldRepository'
import { defineRoute, type IpcRoute } from './registry'

/**
 * Canaux de la vue Workflow (spec 023) : lire la vue d'un projet lié, lire un fichier cité ou de méthode (lecture
 * seule) et ses raccourcis (méthodes, fonctions, classes), mémoriser le repli d'un nœud. Rien n'écrit dans le projet.
 */
export function createWorkflowRoutes(
  workflow: Pick<WorkflowService, 'read' | 'file'>,
  folds: Pick<WorkflowFoldRepository, 'set'>,
  genesisExists: (genesisId: string) => boolean,
  symbols?: Pick<WorkflowSymbols, 'symbols'>,
  chats?: Pick<WorkflowChats, 'open'>
): IpcRoute[] {
  return [
    defineRoute({
      channel: 'workflow:read',
      input: z.strictObject({ genesisId: z.uuid() }),
      handler: async ({ genesisId }) => workflow.read(genesisId)
    }),
    defineRoute({
      channel: 'workflow:file',
      input: z.strictObject({ genesisId: z.uuid(), path: ProjectFile }),
      handler: async ({ genesisId, path }) => workflow.file(genesisId, path)
    }),
    defineRoute({
      channel: 'workflow:symbols',
      input: z.strictObject({ genesisId: z.uuid(), path: ProjectFile }),
      handler: async ({ genesisId, path }) => (symbols === undefined ? [] : symbols.symbols(genesisId, path))
    }),
    defineRoute({
      channel: 'workflow:chat',
      input: z
        .strictObject({
          genesisId: z.uuid(),
          key: z.string().max(160).regex(WORKFLOW_KEY),
          title: z.string().trim().min(1).max(200)
        })
        .refine((input) => input.key.startsWith(`wf:${input.genesisId}:`), 'clé d’un autre projet'),
      handler: async ({ genesisId, key, title }) => {
        if (chats === undefined) throw new AppError('NOT_FOUND', 'Conversation indisponible.')
        return chats.open(genesisId, key, title)
      }
    }),
    defineRoute({
      channel: 'workflow:setFolded',
      input: z
        .strictObject({ genesisId: z.uuid(), key: z.string().max(160).regex(WORKFLOW_KEY), folded: z.boolean() })
        .refine((input) => input.key.startsWith(`wf:${input.genesisId}:`), 'clé d’un autre projet'),
      handler: async ({ genesisId, key, folded }) => {
        if (!genesisExists(genesisId)) throw new AppError('NOT_FOUND', 'Projet introuvable.')
        folds.set(genesisId, key, folded)
        return { ok: true }
      }
    })
  ]
}
