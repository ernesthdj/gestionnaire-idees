import { z } from 'zod'
import { CONFIDENTIALITY_LEVELS } from '@shared/ipc/reprise'
import type { RepriseService } from '../application/reprise/RepriseService'
import { defineRoute, type IpcRoute } from './registry'

/**
 * Canaux `reprise:*` (spec 017 contracts) : le chemin d'un projet ne vient jamais de l'interface — le dossier est
 * choisi au sélecteur natif du main, puis désigné par un `previewId` éphémère.
 */
export function createRepriseRoutes(
  reprise: Pick<RepriseService, 'previewFolder' | 'create' | 'view' | 'setConfidentiality'>
): IpcRoute[] {
  return [
    defineRoute({
      channel: 'reprise:previewFolder',
      input: z.undefined(),
      handler: async () => reprise.previewFolder()
    }),
    defineRoute({
      channel: 'reprise:create',
      // La confidentialité est obligatoire : aucune valeur par défaut (spec 017 FR-003).
      input: z.strictObject({ previewId: z.uuid(), confidentiality: z.enum(CONFIDENTIALITY_LEVELS) }),
      handler: async ({ previewId, confidentiality }) => reprise.create(previewId, confidentiality)
    }),
    defineRoute({
      channel: 'reprise:get',
      input: z.strictObject({ genesisId: z.uuid() }),
      handler: async ({ genesisId }) => reprise.view(genesisId)
    }),
    defineRoute({
      channel: 'reprise:setConfidentiality',
      input: z.strictObject({
        genesisId: z.uuid(),
        level: z.enum(CONFIDENTIALITY_LEVELS),
        confirm: z.literal(true).optional()
      }),
      handler: async ({ genesisId, level, confirm }) => reprise.setConfidentiality(genesisId, level, confirm === true)
    })
  ]
}
