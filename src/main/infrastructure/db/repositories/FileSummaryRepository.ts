import { and, eq } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { codeFileSummaries } from '../schemaReprise'

/** Explication enregistrée d'un fichier : l'empreinte du contenu expliqué et le texte (JSON). */
export interface StoredFileSummary {
  readonly contentHash: string
  readonly summaryJson: string
}

/**
 * Explications « Que fait ce fichier ? » enregistrées (spec 023 D18) : une par fichier d'un projet lié ; une nouvelle
 * remplace l'ancienne. Requêtes paramétrées par Drizzle.
 */
export class FileSummaryRepository {
  constructor(private readonly db: AppDatabase) {}

  get(genesisId: string, path: string): StoredFileSummary | undefined {
    return this.db
      .select({ contentHash: codeFileSummaries.contentHash, summaryJson: codeFileSummaries.summaryJson })
      .from(codeFileSummaries)
      .where(and(eq(codeFileSummaries.genesisId, genesisId), eq(codeFileSummaries.path, path)))
      .get()
  }

  put(genesisId: string, path: string, summary: StoredFileSummary): void {
    this.db
      .insert(codeFileSummaries)
      .values({ genesisId, path, ...summary })
      .onConflictDoUpdate({
        target: [codeFileSummaries.genesisId, codeFileSummaries.path],
        set: { ...summary, createdAt: new Date().toISOString() }
      })
      .run()
  }
}
