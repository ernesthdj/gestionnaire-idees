import type { ToolResult } from '@shared/mcp/protocol'
import type {
  ActionProposerInput,
  FichierEcrireInput,
  FichierModifierInput,
  CommandeLancerInput,
  FicheEcrireInput,
  PermissionDemanderInput,
  MaturiteEvaluerInput,
  DocumentEcrireInput,
  McpToolName,
  PlanProposerInput,
  StructureDessinerInput
} from '@shared/mcp/tools'
import type { McpCaller } from '../../domain/mcp/caller'
import type { MapService } from './MapService'
import type { NeuronTools } from './NeuronTools'
import type { PlanTools } from './PlanTools'
import type { DocumentTools } from './DocumentTools'
import type { FinalTools } from './FinalTools'
import type { StructureService } from '../structure/StructureService'
import type { PermissionService } from '../conversation/PermissionService'
import { McpToolError } from '../../domain/mcp/errors'

/** Aiguillage des outils du pont : carte (spec 007) ou neurone de la conversation (spec 008). */
export function createToolHandler(
  map: Pick<MapService, 'handle'>,
  neurons: NeuronTools,
  structure: Pick<StructureService, 'draw' | 'read'>,
  plan: Pick<PlanTools, 'propose'>,
  documents: Pick<DocumentTools, 'write' | 'read'>,
  finals: Pick<FinalTools, 'propose' | 'write' | 'modify' | 'run'>,
  permissions?: Pick<PermissionService, 'request'>
): (tool: McpToolName, args: unknown, caller: McpCaller) => ToolResult | Promise<ToolResult> {
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
      case 'document_ecrire':
        return documents.write(args as DocumentEcrireInput, caller)
      case 'document_lire':
        return documents.read((args as { document: string }).document, caller)
      case 'action_proposer':
        return finals.propose(args as ActionProposerInput, caller)
      case 'fichier_ecrire':
        return finals.write(args as FichierEcrireInput, caller)
      case 'fichier_modifier':
        return finals.modify(args as FichierModifierInput, caller)
      case 'commande_lancer':
        return finals.run(args as CommandeLancerInput, caller)
      case 'permission_demander': {
        // Seule une conversation de l’app (spec 014 R1) : sa demande attend la réponse de mentalyas dans son chat.
        if (caller.neuronId === null || permissions === undefined) {
          throw new McpToolError('NON_MODIFIABLE', 'Demande de permission hors d’une conversation du Brainstormer.')
        }
        const request = args as PermissionDemanderInput
        return permissions
          .request(caller.neuronId, request.tool_name, request.input)
          .then((answer) => ({ text: JSON.stringify(answer) }))
      }
      case 'plan_proposer':
        return plan.propose(args as PlanProposerInput, caller)
      case 'structure_lire':
        return structure.read((args as { projet?: string }).projet, caller)
      default:
        return map.handle(tool, args, caller)
    }
  }
}
