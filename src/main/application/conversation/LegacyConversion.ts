import { randomUUID } from 'node:crypto'
import { isEmptySheet } from '../../domain/conversation/sheet'
import { legacySheet, type LegacyIdea } from '../../domain/conversation/legacySheet'

export interface LegacyConversionPort {
  isConverted(): boolean
  ideasWithoutSheet(): LegacyIdea[]
  saveConversion(batchId: string, sheets: ReadonlyMap<string, string>): void
}

export interface LegacyConversionResult {
  readonly converted: number
  /** Lot d'Historique (annulable) ; `null` si aucune fiche n'a été écrite. */
  readonly batchId: string | null
}

/**
 * Conversion unique des idées de l'ancien moteur (spec 010 US3, FR-004) : chaque idée sans fiche reçoit une fiche
 * assemblée localement. Une idée qui a déjà une fiche (tenue par Claude) n'est jamais touchée ; une idée sans
 * réponse ni document n'en reçoit pas. Idempotente : ne fait rien une fois le marqueur posé.
 */
export function convertLegacyIdeas(port: LegacyConversionPort): LegacyConversionResult {
  if (port.isConverted()) return { converted: 0, batchId: null }
  const sheets = new Map<string, string>()
  for (const idea of port.ideasWithoutSheet()) {
    const sheet = legacySheet(idea)
    if (!isEmptySheet(sheet)) sheets.set(idea.id, JSON.stringify(sheet))
  }
  const batchId = randomUUID()
  port.saveConversion(batchId, sheets)
  return { converted: sheets.size, batchId: sheets.size === 0 ? null : batchId }
}
