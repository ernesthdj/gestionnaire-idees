import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { ANALYSTE_SETTINGS_LIMITS, type AnalysteSettingsView } from '@shared/ipc/analyste'
import type { AppDatabase } from '../client'
import { settings } from '../schemaNeurons'

const LIMITS = ANALYSTE_SETTINGS_LIMITS

/** Réglages de l'Analyste (spec 019 data-model), une clé `settings` chacun, validés à la lecture comme à l'écriture. */
const FIELDS = {
  retentionDays: {
    key: 'analyste.retentionDays',
    schema: z.int().min(LIMITS.retentionDays.min).max(LIMITS.retentionDays.max)
  },
  maxEvents: { key: 'analyste.maxEvents', schema: z.int().min(LIMITS.maxEvents.min).max(LIMITS.maxEvents.max) }
} as const

const REPO_KEY = 'analyste.repoPath'
const RepoSchema = z.string().min(1).max(1000)

const DEFAULTS: AnalysteSettingsView = {
  retentionDays: LIMITS.retentionDays.default,
  maxEvents: LIMITS.maxEvents.default
}

const safeJson = (json: string): unknown => {
  try {
    return JSON.parse(json)
  } catch {
    return undefined
  }
}

export class AnalysteRepository {
  constructor(private readonly db: AppDatabase) {}

  settings(): AnalysteSettingsView {
    const read = (field: keyof typeof FIELDS): number => {
      const row = this.db.select().from(settings).where(eq(settings.key, FIELDS[field].key)).get()
      if (row === undefined) return DEFAULTS[field]
      const parsed = FIELDS[field].schema.safeParse(safeJson(row.valueJson))
      return parsed.success ? parsed.data : DEFAULTS[field]
    }
    return { retentionDays: read('retentionDays'), maxEvents: read('maxEvents') }
  }

  /** Lève une erreur Zod si une valeur est hors bornes (rien n'est écrit). */
  updateSettings(patch: Partial<AnalysteSettingsView>): AnalysteSettingsView {
    const entries = (Object.keys(patch) as (keyof typeof FIELDS)[]).flatMap((field) => {
      const value = patch[field]
      return value === undefined
        ? []
        : [{ key: FIELDS[field].key, valueJson: JSON.stringify(FIELDS[field].schema.parse(value)) }]
    })
    this.db.transaction((tx) => {
      for (const entry of entries) {
        tx.insert(settings)
          .values(entry)
          .onConflictDoUpdate({ target: settings.key, set: { valueJson: entry.valueJson } })
          .run()
      }
    })
    return this.settings()
  }

  repoPath(): string | null {
    const row = this.db.select().from(settings).where(eq(settings.key, REPO_KEY)).get()
    if (row === undefined) return null
    const parsed = RepoSchema.safeParse(safeJson(row.valueJson))
    return parsed.success ? parsed.data : null
  }

  saveRepoPath(path: string): void {
    const valueJson = JSON.stringify(RepoSchema.parse(path))
    this.db
      .insert(settings)
      .values({ key: REPO_KEY, valueJson })
      .onConflictDoUpdate({ target: settings.key, set: { valueJson } })
      .run()
  }
}
