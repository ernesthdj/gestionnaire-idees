import { randomUUID } from 'node:crypto'
import { isEmptySheet } from '../../domain/conversation/sheet'
import { legacySheet, type LegacyIdea } from '../../domain/conversation/legacySheet'
import type { ConversionPlan, LegacyLink, LegacyStepInput } from '../../infrastructure/db/repositories/LegacyRepository'

export interface LegacyConversionPort {
  isConverted(): boolean
  ideasWithoutSheet(): LegacyIdea[]
  linksToConvert(): LegacyLink[]
  stepInputs(): LegacyStepInput[]
  saveConversion(batchId: string, plan: ConversionPlan): void
}

export interface LegacyConversionResult {
  readonly sheets: number
  readonly links: number
  readonly stepInputs: number
  /** Lot d'Historique (annulable) ; `null` si rien n'a été converti. */
  readonly batchId: string | null
}

/**
 * Conversion unique des données de l'ancien moteur (spec 010 US3, FR-004), en un seul lot d'Historique annulable :
 * - chaque idée sans fiche reçoit une fiche assemblée localement (jamais une idée qui en a déjà une, tenue par
 *   Claude ; jamais une fiche vide) ;
 * - chaque lien accepté entre deux idées devient un lien libre de la carte ;
 * - chaque branchement d'une prochaine étape vers un widget devient un branchement de l'idée elle-même.
 * Idempotente : ne fait rien une fois le marqueur posé.
 */
export function convertLegacyIdeas(port: LegacyConversionPort): LegacyConversionResult {
  if (port.isConverted()) return { sheets: 0, links: 0, stepInputs: 0, batchId: null }
  const sheets = new Map<string, string>()
  for (const idea of port.ideasWithoutSheet()) {
    const sheet = legacySheet(idea)
    if (!isEmptySheet(sheet)) sheets.set(idea.id, JSON.stringify(sheet))
  }
  const plan: ConversionPlan = { sheets, links: port.linksToConvert(), stepInputs: port.stepInputs() }
  const batchId = randomUUID()
  port.saveConversion(batchId, plan)
  const empty = sheets.size === 0 && plan.links.length === 0 && plan.stepInputs.length === 0
  return {
    sheets: sheets.size,
    links: plan.links.length,
    stepInputs: plan.stepInputs.length,
    batchId: empty ? null : batchId
  }
}
