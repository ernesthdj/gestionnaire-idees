import { z } from 'zod'
import { CODE_CATEGORIES, CONFIDENTIALITY_LEVELS } from '@shared/ipc/reprise'
import type { AnalysisService } from '../application/reprise/AnalysisService'
import type { GuideService } from '../application/reprise/GuideService'
import type { RepriseService } from '../application/reprise/RepriseService'
import { defineRoute, type IpcRoute } from './registry'

/**
 * Canaux `reprise:*` (spec 017 contracts) : le chemin d'un projet ne vient jamais de l'interface — le dossier est
 * choisi au sélecteur natif du main, puis désigné par un `previewId` éphémère.
 */
export function createRepriseRoutes(
  reprise: Pick<RepriseService, 'previewFolder' | 'create' | 'view' | 'setConfidentiality'>,
  analysis?: Pick<AnalysisService, 'analyze' | 'cancel' | 'setCategory' | 'setTarget'>,
  guide?: Pick<GuideService, 'generate'>
): IpcRoute[] {
  return [
    ...(guide === undefined
      ? []
      : [
          defineRoute({
            channel: 'reprise:guide',
            input: z.strictObject({ genesisId: z.uuid() }),
            handler: async ({ genesisId }) => guide.generate(genesisId)
          })
        ]),
    ...(analysis === undefined
      ? []
      : [
          defineRoute({
            channel: 'reprise:analyze',
            input: z.strictObject({ genesisId: z.uuid() }),
            handler: async ({ genesisId }) => analysis.analyze(genesisId)
          }),
          defineRoute({
            channel: 'reprise:cancelAnalysis',
            input: z.strictObject({ genesisId: z.uuid() }),
            handler: async ({ genesisId }) => {
              analysis.cancel(genesisId)
              return { ok: true }
            }
          }),
          defineRoute({
            channel: 'reprise:setCategory',
            input: z.strictObject({
              genesisId: z.uuid(),
              symbolId: z.string().regex(/^[0-9a-f]{32}$/),
              category: z.enum(CODE_CATEGORIES)
            }),
            handler: async ({ genesisId, symbolId, category }) => {
              analysis.setCategory(genesisId, symbolId, category)
              return { ok: true }
            }
          }),
          defineRoute({
            channel: 'reprise:setTarget',
            input: z.strictObject({
              genesisId: z.uuid(),
              edgeId: z.string().regex(/^[0-9a-f]{32}$/),
              targetSymbolId: z
                .string()
                .regex(/^[0-9a-f]{32}$/)
                .nullable()
            }),
            handler: async ({ genesisId, edgeId, targetSymbolId }) => {
              analysis.setTarget(genesisId, edgeId, targetSymbolId)
              return { ok: true }
            }
          })
        ]),
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
