import type { Usage } from './types'

/** Tarifs en dollars par million de tokens (research R9 ; à mettre à jour depuis la page de prix Anthropic). */
export interface ModelPricing {
  readonly inputUsdPerMTok: number
  readonly outputUsdPerMTok: number
  readonly cacheReadUsdPerMTok: number
  readonly cacheWriteUsdPerMTok: number
}

function pricing(input: number, output: number): ModelPricing {
  // Lecture de cache ≈ 10 % du prix d'entrée ; écriture de cache (5 min) ≈ 125 %.
  return {
    inputUsdPerMTok: input,
    outputUsdPerMTok: output,
    cacheReadUsdPerMTok: input * 0.1,
    cacheWriteUsdPerMTok: input * 1.25
  }
}

export const DEFAULT_PRICING: Readonly<Record<string, ModelPricing>> = {
  'claude-opus-5': pricing(5, 25),
  // Cible possible de la bascule serveur en cas de refus (fallbacks « default »).
  'claude-opus-4-8': pricing(5, 25),
  'claude-sonnet-5': pricing(2, 10),
  'claude-haiku-4-5': pricing(1, 5)
}

const MILLICENTS_PER_EURO = 100_000

/** Coût réel d'un appel en millicentimes d'euro (entier). Modèle sans tarif (IA locale) : gratuit. */
export function costMillicents(usage: Usage, price: ModelPricing | undefined, usdEurRate: number): number {
  if (price === undefined) return 0
  const usd =
    (usage.inputTokens * price.inputUsdPerMTok +
      usage.outputTokens * price.outputUsdPerMTok +
      usage.cacheReadTokens * price.cacheReadUsdPerMTok +
      usage.cacheWriteTokens * price.cacheWriteUsdPerMTok) /
    1_000_000
  return Math.round(usd * usdEurRate * MILLICENTS_PER_EURO)
}

/** Majorant du coût d'un appel avant de l'envoyer : entrée estimée + sortie maximale autorisée. */
export function estimateMaxMillicents(
  estimate: { readonly inputTokens: number; readonly maxOutputTokens: number },
  price: ModelPricing | undefined,
  usdEurRate: number
): number {
  return costMillicents(
    {
      inputTokens: estimate.inputTokens,
      outputTokens: estimate.maxOutputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0
    },
    price,
    usdEurRate
  )
}

export type BudgetState = 'normal' | 'alert' | 'blocked' | 'unlocked'

/** État du budget mensuel (spec 001 FR-008) : alerte au seuil, blocage au plafond sauf déblocage du mois. */
export function budgetState(
  spentMillicents: number,
  capMillicents: number,
  alertRatio: number,
  unlocked: boolean
): BudgetState {
  if (spentMillicents >= capMillicents) return unlocked ? 'unlocked' : 'blocked'
  return spentMillicents >= capMillicents * alertRatio ? 'alert' : 'normal'
}

/** Mois calendaire local au format `YYYY-MM`. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Premier instant du mois local de `date`. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** Tarif d'un modèle Claude ; un modèle inconnu (ex. nouvelle cible de bascule) prend le tarif du modèle configuré. */
export function pricingFor(model: string, configuredModel: string): ModelPricing | undefined {
  return DEFAULT_PRICING[model] ?? DEFAULT_PRICING[configuredModel]
}
