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
  claudeModel: z.string().min(1).max(60).default('claude-opus-5-5'),
  /** Modèle des widgets (spec 004) : Sonnet, excellent en code et deux fois moins cher qu'Opus. */
  widgetModel: z.string().min(1).max(60).default('claude-sonnet-5-5'),
  /** Modèle des conversations des éléments de projet (spec 010 D3) : Sonnet, plus économe. */
  elementModel: z.string().min(1).max(60).default('claude-sonnet-5-5'),
  localModel: z.string().min(1).max(80).default('qwen3.5:9b'),
  allowClaudeFallback: z.boolean().default(false),
  /** Montants exacts envoyés à Claude par défaut (choix de mentalyas, constitution v1.1.0). */
  maskAmounts: z.boolean().default(false),
  routing: z.record(TaskKind, Engine).default({ ...DEFAULT_ROUTING }),
  /** Révision des réglages par défaut déjà appliquée (voir `withRevision`). */
  revision: z.number().int().min(1).default(1)
})
export type AiConfig = z.infer<typeof AiConfigSchema>

const CONFIG_KEY = 'ai'

/**
 * Un type de tâche ajouté par une nouvelle version n'existe pas dans la table de routage enregistrée :
 * on complète avec la valeur par défaut au lieu de rejeter tout le document (et perdre les réglages).
 */
function withNewTaskKinds(stored: unknown): unknown {
  if (typeof stored !== 'object' || stored === null || !('routing' in stored)) return stored
  const { routing } = stored
  if (typeof routing !== 'object' || routing === null) return stored
  return { ...stored, routing: { ...DEFAULT_ROUTING, ...routing } }
}

/** Révision 2 (2026-09-29, T069) : économies décidées par mentalyas après mesure des coûts. */
export const CONFIG_REVISION = 2

/**
 * Applique une seule fois les nouveaux défauts aux réglages enregistrés avant eux : questions, graines et liens
 * en local, `claude-opus-5` → `claude-opus-5-5` (20 % moins cher). Un choix fait ensuite dans Réglages › IA est
 * enregistré avec la révision courante et n'est plus jamais modifié.
 */
function withRevision(config: AiConfig): AiConfig {
  if (config.revision >= CONFIG_REVISION) return config
  return {
    ...config,
    revision: CONFIG_REVISION,
    claudeModel: config.claudeModel === 'claude-opus-5' ? 'claude-opus-5-5' : config.claudeModel,
    routing: { ...config.routing, etendre: 'ollama', germer: 'ollama', suggerer_liens: 'ollama' }
  }
}

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
    const parsed = AiConfigSchema.safeParse(withNewTaskKinds(stored))
    // Document corrompu ou d'une ancienne version : on repart des valeurs par défaut plutôt que de planter.
    return withRevision(parsed.success ? parsed.data : AiConfigSchema.parse({}))
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
