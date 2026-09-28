import { z } from 'zod'
import { DEFAULT_ROUTING } from '../../../domain/ai/routing'
import { LOCAL_TASK_KINDS, REMOTE_TASK_KINDS } from '../../../domain/ai/types'
import type { AppDatabase } from '../client'
import { aiConfig } from '../schema'

const Engine = z.enum(['ollama', 'claude'])
const TaskKind = z.enum([...LOCAL_TASK_KINDS, ...REMOTE_TASK_KINDS])

/** Configuration IA validée (data-model 001 `ai_config`) ; chaque clé a une valeur par défaut. */
export const AiConfigSchema = z.object({
  capCents: z.number().int().min(0).max(100_000).default(1000),
  alertRatio: z.number().min(0.5).max(0.95).default(0.8),
  unlockedMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .default(null),
  usdEurRate: z.number().min(0.5).max(2).default(0.92),
  claudeModel: z.string().min(1).max(60).default('claude-opus-5'),
  localModel: z.string().min(1).max(80).default('qwen3.5:9b'),
  allowClaudeFallback: z.boolean().default(false),
  routing: z.record(TaskKind, Engine).default({ ...DEFAULT_ROUTING })
})
export type AiConfig = z.infer<typeof AiConfigSchema>

const CONFIG_KEY = 'ai'

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
    // Document corrompu ou d'une ancienne version : on repart des valeurs par défaut plutôt que de planter.
    return parsed.success ? parsed.data : AiConfigSchema.parse({})
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
