import { eq, like } from 'drizzle-orm'
import { z } from 'zod'
import { isValidAccelerator } from '@shared/app/accelerator'
import {
  CAPTURE_MAX_CHARS,
  DEFAULT_APP_SETTINGS,
  MOTION_MODES,
  THEMES,
  type AppSettingsPatch,
  type AppSettingsView
} from '@shared/ipc/app'
import { EDITOR_KINDS } from '../../../domain/finals/editor'
import type { AppDatabase } from '../client'
import { settings } from '../schemaNeurons'

/** Une clé `settings` par réglage (data-model 003) ; chaque valeur est validée à la lecture comme à l'écriture. */
const FIELDS = {
  shortcut: { key: 'app.shortcut', schema: z.string().refine(isValidAccelerator) },
  launchAtLogin: { key: 'app.launchAtLogin', schema: z.boolean() },
  theme: { key: 'app.theme', schema: z.enum(THEMES) },
  motion: { key: 'app.motion', schema: z.enum(MOTION_MODES) },
  onboardingDone: { key: 'app.onboardingDone', schema: z.boolean() }
} as const

const DRAFT_KEY = 'capture.draft'
const DraftSchema = z.string().max(CAPTURE_MAX_CHARS)

const EDITOR_KEY = 'editor.program'
const EditorSchema = z.object({ kind: z.enum(EDITOR_KINDS), program: z.string().min(1).max(1000) }).strict()
export type EditorSetting = z.infer<typeof EditorSchema>

type Field = keyof typeof FIELDS

export class AppSettingsRepository {
  constructor(private readonly db: AppDatabase) {}

  get(): AppSettingsView {
    const stored = new Map(
      this.db
        .select()
        .from(settings)
        .where(like(settings.key, 'app.%'))
        .all()
        .map((row) => [row.key, row.valueJson])
    )
    const read = <F extends Field>(field: F): AppSettingsView[F] => {
      const json = stored.get(FIELDS[field].key)
      if (json === undefined) return DEFAULT_APP_SETTINGS[field]
      // Valeur corrompue ou d'une ancienne version : on revient au défaut plutôt que de planter.
      const parsed = FIELDS[field].schema.safeParse(safeJson(json))
      return parsed.success ? (parsed.data as AppSettingsView[F]) : DEFAULT_APP_SETTINGS[field]
    }
    return {
      shortcut: read('shortcut'),
      launchAtLogin: read('launchAtLogin'),
      theme: read('theme'),
      motion: read('motion'),
      onboardingDone: read('onboardingDone')
    }
  }

  /** Enregistre les réglages fournis ; lève une erreur Zod si l'un d'eux est invalide (rien n'est écrit). */
  update(patch: AppSettingsPatch & { readonly onboardingDone?: boolean }): AppSettingsView {
    const entries = (Object.keys(patch) as Field[]).flatMap((field) => {
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
    return this.get()
  }

  /** Éditeur réglé pour « Ouvrir dans l'éditeur » (spec 013 D4) ; `null` : aucun. */
  editor(): EditorSetting | null {
    const row = this.db.select().from(settings).where(eq(settings.key, EDITOR_KEY)).get()
    if (row === undefined) return null
    const parsed = EditorSchema.safeParse(safeJson(row.valueJson))
    return parsed.success ? parsed.data : null
  }

  saveEditor(editor: EditorSetting | null): void {
    if (editor === null) {
      this.db.delete(settings).where(eq(settings.key, EDITOR_KEY)).run()
      return
    }
    const valueJson = JSON.stringify(EditorSchema.parse(editor))
    this.db
      .insert(settings)
      .values({ key: EDITOR_KEY, valueJson })
      .onConflictDoUpdate({ target: settings.key, set: { valueJson } })
      .run()
  }

  draft(): string {
    const row = this.db.select().from(settings).where(eq(settings.key, DRAFT_KEY)).get()
    const parsed = DraftSchema.safeParse(row === undefined ? '' : safeJson(row.valueJson))
    return parsed.success ? parsed.data : ''
  }

  saveDraft(text: string): void {
    const valueJson = JSON.stringify(DraftSchema.parse(text))
    this.db
      .insert(settings)
      .values({ key: DRAFT_KEY, valueJson })
      .onConflictDoUpdate({ target: settings.key, set: { valueJson } })
      .run()
  }
}

function safeJson(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return undefined
  }
}
