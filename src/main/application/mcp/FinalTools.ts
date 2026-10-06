import type { ToolResult } from '@shared/mcp/protocol'
import type {
  ActionProposerInput,
  CommandeLancerInput,
  FichierEcrireInput,
  FichierModifierInput
} from '@shared/mcp/tools'
import type { CommandService } from '../finals/CommandService'
import type { McpCaller } from '../../domain/mcp/caller'
import type { ConversationRepository } from '../../infrastructure/db/repositories/ConversationRepository'
import type { ExecutionService, WrittenFile } from '../finals/ExecutionService'
import type { FinalService } from '../finals/FinalService'
import { McpToolError } from '../../domain/mcp/errors'
import { conversationTarget } from './target'

export interface FinalToolsDeps {
  readonly finals: Pick<FinalService, 'propose'>
  /** Écritures dans le projet lié, pendant une exécution seulement (spec 013 US2). */
  readonly executions?: Pick<ExecutionService, 'write' | 'modify'>
  /** Scripts approuvés, lancés pendant une exécution seulement (spec 013 D2 bis). */
  readonly commands?: Pick<CommandService, 'run'>
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

  write(input: FichierEcrireInput, caller: McpCaller): ToolResult {
    return this.written(this.executions().write(caller.neuronId, input.chemin, input.contenu))
  }

  modify(input: FichierModifierInput, caller: McpCaller): ToolResult {
    return this.written(this.executions().modify(caller.neuronId, input.chemin, input.ancien, input.nouveau))
  }

  async run(input: CommandeLancerInput, caller: McpCaller): Promise<ToolResult> {
    const { commands } = this.deps
    if (commands === undefined) throw new McpToolError('NON_MODIFIABLE', 'Commandes indisponibles.')
    const result = await commands.run(caller.neuronId, input.script)
    const status = result.timedOut
      ? 'arrêté : délai de 5 minutes dépassé'
      : result.exitCode === null
        ? 'lancement impossible'
        : `code de sortie ${result.exitCode}${result.exitCode === 0 ? ' (réussi)' : ' (échec)'}`
    return {
      text: `npm run ${input.script} — ${status}, ${Math.round(result.durationMs / 1000)} s.\n\n${result.output}`,
      data: { script: input.script, code: result.exitCode, delaiDepasse: result.timedOut }
    }
  }

  private executions(): Pick<ExecutionService, 'write' | 'modify'> {
    const { executions } = this.deps
    if (executions === undefined) throw new McpToolError('NON_MODIFIABLE', 'Exécution indisponible.')
    return executions
  }

  private written(file: WrittenFile): ToolResult {
    return {
      text: `${file.path} ${file.status === 'cree' ? 'créé' : 'modifié'} (ajouté au livrable de l’action).`,
      data: { chemin: file.path, statut: file.status }
    }
  }
}
