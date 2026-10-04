import type { ToolResult } from '@shared/mcp/protocol'
import type { FicheEcrireInput, MaturiteEvaluerInput, McpToolName } from '@shared/mcp/tools'
import type { McpCaller } from '../../domain/mcp/caller'
import type { MapService } from './MapService'
import type { NeuronTools } from './NeuronTools'

/** Aiguillage des outils du pont : carte (spec 007) ou neurone de la conversation (spec 008). */
export function createToolHandler(
  map: Pick<MapService, 'handle'>,
  neurons: NeuronTools
): (tool: McpToolName, args: unknown, caller: McpCaller) => ToolResult {
  return (tool, args, caller) => {
    switch (tool) {
      case 'neurone_contexte':
        return neurons.context((args as { id?: string }).id, caller)
      case 'fiche_ecrire':
        return neurons.writeSheet(args as FicheEcrireInput, caller)
      case 'maturite_evaluer':
        return neurons.evaluate(args as MaturiteEvaluerInput, caller)
      default:
        return map.handle(tool, args)
    }
  }
}
