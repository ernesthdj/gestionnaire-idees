import { ResolutionOut } from '@shared/ai/schemas'
import type { AIError, Engine, Result } from '../../domain/ai/types'
import type { AIGateway, AIResult } from './AIGateway'

/** Un appel ambigu soumis à la tâche `reprise_resolution` (spec 017 contracts). */
export interface ResolutionItem {
  readonly edgeId: string
  /** L'appel tel qu'écrit (`store.Save`). */
  readonly call: string
  /** Au plus 8 lignes de code autour de l'appel. */
  readonly context: readonly string[]
  readonly candidates: readonly { readonly id: string; readonly label: string }[]
}

/** Appels par requête (spec 017 R6) et lignes de contexte par appel. */
export const RESOLUTION_BATCH = 50
export const RESOLUTION_CONTEXT_LINES = 8
const LIMITS = { call: 200, line: 240, label: 240 } as const

const clip = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max)}…`)

/**
 * Entrée de la tâche : un JSON (le contenu du projet y est échappé, il ne peut pas se faire passer pour une consigne ou
 * pour un autre élément), borné — au plus 50 éléments, 8 lignes de 240 caractères par élément.
 */
export function buildResolutionInput(items: readonly ResolutionItem[]): string {
  return JSON.stringify({
    items: items.slice(0, RESOLUTION_BATCH).map((item) => ({
      edgeId: item.edgeId,
      call: clip(item.call, LIMITS.call),
      context: item.context.slice(0, RESOLUTION_CONTEXT_LINES).map((line) => clip(line, LIMITS.line)),
      candidates: item.candidates.map((candidate) => ({ id: candidate.id, label: clip(candidate.label, LIMITS.label) }))
    }))
  })
}

/**
 * Tâche `reprise_resolution` par la passerelle : Claude si le projet l'autorise, sinon le modèle local, sans repli
 * (`localOnly`, constitution IV) ; modèle local arrêté → `AI_UNAVAILABLE`. Aucun outil : seuls les extraits partent.
 */
export function runRepriseResolution(
  gateway: AIGateway,
  items: readonly ResolutionItem[],
  options: { readonly localOnly: boolean; readonly onEngine?: (engine: Engine, model: string) => void }
): Promise<Result<AIResult<ResolutionOut>, AIError>> {
  return gateway.run({
    kind: 'reprise_resolution',
    input: buildResolutionInput(items),
    schema: ResolutionOut,
    localOnly: options.localOnly,
    ...(options.onEngine === undefined ? {} : { onEngine: options.onEngine })
  })
}
