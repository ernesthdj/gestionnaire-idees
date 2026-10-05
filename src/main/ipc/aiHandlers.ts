import { z } from 'zod'
import { CLAUDE_MODELS, type AiConfigView, type AiStatusView, type AiTestView } from '@shared/ipc/ai'
import type { ProviderStatus } from '../application/ai/AIProvider'
import type { AiConfig } from '../infrastructure/db/repositories/AiConfigRepository'
import { defineRoute, type IpcRoute } from './registry'

/** Nom de l'ancien secret de la clé API (spec 001), supprimé au démarrage depuis la spec 010. */
export const LEGACY_CLAUDE_SECRET = 'claude'

export interface AiRoutesDependencies {
  readonly config: { get(): AiConfig; update(patch: Partial<AiConfig>): AiConfig }
  readonly ollamaStatus: () => Promise<ProviderStatus>
  /** Claude Code trouvé sur la machine (aucun jeton consommé). */
  readonly claudeStatus: () => Promise<ProviderStatus>
}

/** Étapes d'installation affichées quand l'IA locale n'est pas prête (analyse U1, tâche T060). */
export function ollamaGuidance(status: ProviderStatus, model: string): string[] {
  if (status.up) return []
  const download = `Télécharger le modèle : ouvrir un terminal et lancer « ollama pull ${model} ».`
  const recheck = 'Cliquer sur « Revérifier ».'
  if (status.problem === 'model_missing') return [download, recheck]
  return ['Installer Ollama depuis https://ollama.com puis le lancer.', download, recheck]
}

function configView(config: AiConfig): AiConfigView {
  return {
    claudeModel: config.claudeModel,
    elementModel: config.elementModel,
    widgetModel: config.widgetModel,
    localModel: config.localModel,
    allowClaudeFallback: config.allowClaudeFallback
  }
}

const ConfigPatch = z
  .object({
    claudeModel: z.enum(CLAUDE_MODELS),
    elementModel: z.enum(CLAUDE_MODELS),
    widgetModel: z.enum(CLAUDE_MODELS),
    localModel: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[\w.:/-]+$/),
    allowClaudeFallback: z.boolean()
  })
  .partial()
  .strict()

/** Canaux `ai:*` (spec 010) : état d'Ollama et de Claude Code, modèles par usage. */
export function createAiRoutes(deps: AiRoutesDependencies): IpcRoute[] {
  return [
    defineRoute({
      channel: 'ai:status',
      input: z.undefined(),
      handler: async (): Promise<AiStatusView> => {
        const config = deps.config.get()
        const [ollama, claude] = await Promise.all([deps.ollamaStatus(), deps.claudeStatus()])
        return {
          ollama: {
            up: ollama.up,
            model: config.localModel,
            ...(ollama.reason === undefined ? {} : { reason: ollama.reason }),
            guidance: ollamaGuidance(ollama, config.localModel)
          },
          claude: { ready: claude.up, ...(claude.reason === undefined ? {} : { reason: claude.reason }) }
        }
      }
    }),
    defineRoute({
      channel: 'ai:getConfig',
      input: z.undefined(),
      handler: async () => configView(deps.config.get())
    }),
    defineRoute({
      channel: 'ai:setConfig',
      input: ConfigPatch,
      handler: async (patch) => {
        const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
        return configView(deps.config.update(clean))
      }
    }),
    defineRoute({
      channel: 'ai:test',
      input: z.object({ engine: z.enum(['ollama', 'claude']) }).strict(),
      handler: async ({ engine }): Promise<AiTestView> => {
        const started = Date.now()
        const status = engine === 'ollama' ? await deps.ollamaStatus() : await deps.claudeStatus()
        return status.up
          ? { ok: true, latencyMs: Date.now() - started }
          : {
              ok: false,
              reason: status.reason ?? (engine === 'ollama' ? 'IA locale indisponible' : 'Claude Code introuvable')
            }
      }
    })
  ]
}
