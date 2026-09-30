import { z } from 'zod'
import { CLAUDE_MODELS, type AiConfigView, type AiStatusView, type AiTestView } from '@shared/ipc/ai'
import { ProviderError, type ProviderStatus } from '../application/ai/AIProvider'
import { budgetState, monthKey } from '../domain/ai/cost'
import type { AiConfig } from '../infrastructure/db/repositories/AiConfigRepository'
import { defineRoute, type IpcRoute } from './registry'

export const CLAUDE_SECRET = 'claude'
const KEY_FORMAT = /^sk-ant-[A-Za-z0-9_-]{20,}$/
const MILLICENTS_PER_CENT = 1000

export interface AiRoutesDependencies {
  readonly config: { get(): AiConfig; update(patch: Partial<AiConfig>): AiConfig }
  readonly secrets: {
    get(name: string): string | null
    set(name: string, value: string): void
    delete(name: string): void
  }
  readonly ollamaStatus: () => Promise<ProviderStatus>
  /** Vérifie la clé et le modèle Claude sans consommer de tokens. */
  readonly claudePing: () => Promise<void>
  readonly spentMillicentsThisMonth: () => number
  readonly now: () => Date
}

function mask(key: string): string {
  return `sk-ant-…${key.slice(-4)}`
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
    capCents: config.capCents,
    alertRatio: config.alertRatio,
    usdEurRate: config.usdEurRate,
    claudeModel: config.claudeModel,
    widgetModel: config.widgetModel,
    localModel: config.localModel,
    allowClaudeFallback: config.allowClaudeFallback,
    maskAmounts: config.maskAmounts
  }
}

const ConfigPatch = z
  .object({
    capCents: z.number().int().min(0).max(100_000),
    alertRatio: z.number().min(0.5).max(0.95),
    usdEurRate: z.number().min(0.5).max(2),
    claudeModel: z.enum(CLAUDE_MODELS),
    widgetModel: z.enum(CLAUDE_MODELS),
    localModel: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[\w.:/-]+$/),
    allowClaudeFallback: z.boolean(),
    maskAmounts: z.boolean()
  })
  .partial()
  .strict()

/** Canaux `ai:*` du contrat IPC (contracts/ipc-ai.md) — la clé API n'est jamais renvoyée en clair. */
export function createAiRoutes(deps: AiRoutesDependencies): IpcRoute[] {
  return [
    defineRoute({
      channel: 'ai:status',
      input: z.undefined(),
      handler: async (): Promise<AiStatusView> => {
        const config = deps.config.get()
        const ollama = await deps.ollamaStatus()
        const key = deps.secrets.get(CLAUDE_SECRET)
        const spent = deps.spentMillicentsThisMonth()
        const unlocked = config.unlockedMonth === monthKey(deps.now())
        return {
          ollama: {
            up: ollama.up,
            model: config.localModel,
            ...(ollama.reason === undefined ? {} : { reason: ollama.reason }),
            guidance: ollamaGuidance(ollama, config.localModel)
          },
          claude: {
            configured: key !== null,
            model: config.claudeModel,
            ...(key === null ? {} : { maskedKey: mask(key) })
          },
          budget: {
            spentCents: Math.ceil(spent / MILLICENTS_PER_CENT),
            capCents: config.capCents,
            state: budgetState(spent, config.capCents * MILLICENTS_PER_CENT, config.alertRatio, unlocked)
          }
        }
      }
    }),
    defineRoute({
      channel: 'ai:setClaudeKey',
      input: z.object({ key: z.string().trim().regex(KEY_FORMAT) }).strict(),
      handler: async ({ key }) => {
        deps.secrets.set(CLAUDE_SECRET, key)
        return { configured: true, masked: mask(key) }
      }
    }),
    defineRoute({
      channel: 'ai:clearClaudeKey',
      input: z.undefined(),
      handler: async () => {
        deps.secrets.delete(CLAUDE_SECRET)
        return { configured: false }
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
        if (engine === 'ollama') {
          const status = await deps.ollamaStatus()
          return status.up
            ? { ok: true, latencyMs: Date.now() - started }
            : { ok: false, reason: status.reason ?? 'IA locale indisponible' }
        }
        try {
          await deps.claudePing()
          return { ok: true, latencyMs: Date.now() - started }
        } catch (error) {
          if (error instanceof ProviderError) {
            return { ok: false, reason: error.code === 'AUTH_FAILED' ? 'Clé API refusée ou absente' : error.message }
          }
          return { ok: false, reason: 'Connexion impossible' }
        }
      }
    }),
    defineRoute({
      channel: 'ai:unlockBudget',
      input: z.object({ confirm: z.literal(true) }).strict(),
      handler: async () => {
        deps.config.update({ unlockedMonth: monthKey(deps.now()) })
        return { state: 'unlocked' as const }
      }
    })
  ]
}
