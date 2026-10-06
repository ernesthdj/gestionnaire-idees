import type { ToolResult } from '@shared/mcp/protocol'
import type { ActionProposerInput } from '@shared/mcp/tools'
import type { McpCaller } from '../../domain/mcp/caller'
import type { ConversationRepository } from '../../infrastructure/db/repositories/ConversationRepository'
import type { FinalService } from '../finals/FinalService'
import { conversationTarget } from './target'

export interface FinalToolsDeps {
  readonly finals: Pick<FinalService, 'propose'>
  readonly conversations: Pick<ConversationRepository, 'neuron'>
  /** Une proposition attend mentalyas : la carte la montre, une notification l'annonce. */
  readonly onProposed: (summary: string) => void
}

/**
 * Outils des actions finales (spec 013) : Claude propose qu'une étape feuille devienne exécutable ; rien ne change
 * avant la décision de mentalyas. Une conversation ne propose que dans son arbre.
 */
export class FinalTools {
  constructor(private readonly deps: FinalToolsDeps) {}

  propose(input: ActionProposerInput, caller: McpCaller): ToolResult {
    const step = conversationTarget(this.deps.conversations, input.id, caller, true)
    this.deps.finals.propose({
      neuronId: step.id,
      deliverable: input.livrable,
      reason: input.raison,
      origin: 'claude'
    })
    this.deps.onProposed(`Claude propose « ${step.title} » comme action finale`)
    return {
      text:
        `Action finale proposée à mentalyas pour « ${step.title} » : en attente de sa validation (rien ne change ` +
        'avant). Une fois acceptée, il pourra lancer l’exécution.',
      data: { etape: step.id }
    }
  }
}
