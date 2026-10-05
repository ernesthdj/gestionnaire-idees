import { z } from 'zod'
import type { AppDatabase } from '../client'
import { aiConfig } from '../schema'

/**
 * Configuration IA validée (data-model 001 `ai_config`, réduite par la spec 010) ; chaque clé a une valeur par
 * défaut. Les clés d'anciennes versions (budget, routage, anonymisation) sont ignorées à la lecture.
 */
export const AiConfigSchema = z.object({
  /** Modèle des genesis (spec 010 D3). */
  claudeModel: z.string().min(1).max(60).default('claude-opus-5-5'),
  /** Modèle des widgets (spec 004) : Sonnet, excellent en code. */
  widgetModel: z.string().min(1).max(60).default('claude-sonnet-5-5'),
  /** Modèle des conversations des éléments de projet (spec 010 D3) : Sonnet, plus économe. */
  elementModel: z.string().min(1).max(60).default('claude-sonnet-5-5'),
  localModel: z.string().min(1).max(80).default('qwen3.5:9b'),
  allowClaudeFallback: z.boolean().default(false)
})
export type AiConfig = z.infer<typeof AiConfigSchema>

const CONFIG_KEY = 'ai'

/** Ancien modèle par défaut, remplacé par sa version 5.5 (révision du 2026-09-29). */
const RETIRED_MODELS: Readonly<Record<string, string>> = { 'claude-opus-5': 'claude-opus-5-5' }

/** Configuration stockée comme un seul document JSON validé à la lecture et à l'écriture. */
export class AiConfigRepository {
  constructor(private readonly db: AppDatabase) {}

  get(): AiConfig {
    const row = this.db
      .select()
      .from(aiConfig)
      .all()
      .find((entry) => entry.key === CONFIG_KEY)
    const stored: unknown = row === undefined ? {} : JSON.parse(row.valueJson)
    const parsed = AiConfigSchema.safeParse(stored)
    // Document corrompu : on repart des valeurs par défaut plutôt que de planter.
    const config = parsed.success ? parsed.data : AiConfigSchema.parse({})
    return { ...config, claudeModel: RETIRED_MODELS[config.claudeModel] ?? config.claudeModel }
  }

  update(patch: Partial<AiConfig>): AiConfig {
    const next = AiConfigSchema.parse({ ...this.get(), ...patch })
    this.db
      .insert(aiConfig)
      .values({ key: CONFIG_KEY, valueJson: JSON.stringify(next) })
      .onConflictDoUpdate({ target: aiConfig.key, set: { valueJson: JSON.stringify(next) } })
      .run()
    return next
  }
}
