import type { ToolResult } from '@shared/mcp/protocol'
import type { PlanProposerInput } from '@shared/mcp/tools'
import type { McpCaller } from '../../domain/mcp/caller'
import type { ConversationRepository } from '../../infrastructure/db/repositories/ConversationRepository'
import type { PlanService } from '../plan/PlanService'
import { conversationTarget } from './target'

export interface PlanToolsDeps {
  readonly plan: Pick<PlanService, 'propose'>
  readonly conversations: Pick<ConversationRepository, 'neuron'>
  /** Une proposition attend mentalyas : la carte montre les fantômes, une notification l'annonce (sans « Annuler »). */
  readonly onProposed: (summary: string) => void
}

/**
 * Outils du plan d'attaque (spec 011) : Claude propose ; rien n'est écrit dans les nœuds de mentalyas avant sa
 * décision. Une conversation ne propose que dans son arbre.
 */
export class PlanTools {
  constructor(private readonly deps: PlanToolsDeps) {}

  propose(input: PlanProposerInput, caller: McpCaller): ToolResult {
    const parent = conversationTarget(this.deps.conversations, input.id, caller, true)
    const { proposalId, count } = this.deps.plan.propose({
      parentId: parent.id,
      steps: input.etapes.map((step) => ({
        key: step.cle,
        title: step.titre,
        why: step.pourquoi,
        ...(step.attend === undefined ? {} : { waitsFor: step.attend })
      }))
    })
    const plural = count > 1 ? 's' : ''
    this.deps.onProposed(`Claude propose ${count} étape${plural} pour « ${parent.title} »`)
    return {
      text:
        `${count} étape${plural} proposée${plural} à mentalyas pour « ${parent.title} » : en attente de sa ` +
        'validation (rien n’est encore créé).',
      data: { proposition: proposalId }
    }
  }
}
