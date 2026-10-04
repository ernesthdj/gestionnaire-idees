import type { ToolResult } from '@shared/mcp/protocol'
import type { FicheEcrireInput, MaturiteEvaluerInput, McpToolName, StructureDessinerInput } from '@shared/mcp/tools'
import type { McpCaller } from '../../domain/mcp/caller'
import type { MapService } from './MapService'
import type { NeuronTools } from './NeuronTools'
import type { StructureService } from '../structure/StructureService'

/** Aiguillage des outils du pont : carte (spec 007) ou neurone de la conversation (spec 008). */
export function createToolHandler(
  map: Pick<MapService, 'handle'>,
  neurons: NeuronTools,
  structure: Pick<StructureService, 'draw' | 'read'>
): (tool: McpToolName, args: unknown, caller: McpCaller) => ToolResult {
  return (tool, args, caller) => {
    switch (tool) {
      case 'neurone_contexte':
        return neurons.context((args as { id?: string }).id, caller)
      case 'fiche_ecrire':
        return neurons.writeSheet(args as FicheEcrireInput, caller)
      case 'maturite_evaluer':
        return neurons.evaluate(args as MaturiteEvaluerInput, caller)
      case 'structure_dessiner':
        return structure.draw(args as StructureDessinerInput, caller)
      case 'structure_lire':
        return structure.read((args as { projet?: string }).projet, caller)
      default:
        return map.handle(tool, args)
    }
  }
}
