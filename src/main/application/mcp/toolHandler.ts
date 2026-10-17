import { WRITE_REFUSED_PREFIX } from '@shared/mcp/hook'
import type { ToolResult } from '@shared/mcp/protocol'
import type {
  ActionProposerInput,
  FicheEcrireInput,
  PermissionDemanderInput,
  MaturiteEvaluerInput,
  DocumentEcrireInput,
  EcritureAvantInput,
  McpToolName,
  PlanProposerInput,
  StructureDessinerInput,
  ElementAvancerInput,
  SkillBrouillonInput,
  AgentProfilProposerInput,
  AgentSkillsProposerInput
} from '@shared/mcp/tools'
import type { McpCaller } from '../../domain/mcp/caller'
import type { MapService } from './MapService'
import type { NeuronTools } from './NeuronTools'
import type { PlanTools } from './PlanTools'
import type { DocumentTools } from './DocumentTools'
import type { FinalTools } from './FinalTools'
import type { StructureService } from '../structure/StructureService'
import type { PermissionService } from '../conversation/PermissionService'
import type { DeliverableTracker } from '../finals/DeliverableTracker'
import type { CodeGraphTools } from '../reprise/CodeGraphTools'
import type { SkillTools } from './SkillTools'
import type { AgentProfileTools } from './AgentProfileTools'
import type { AgentTools } from './AgentTools'
import { McpToolError } from '../../domain/mcp/errors'

/** Outils permis dans une conversation Skills (la permission reste relayée à mentalyas). */
const SKILLS_CHAT_TOOLS: ReadonlySet<McpToolName> = new Set([
  'skills_lire',
  'agents_lire',
  'skill_brouillon',
  'agent_profil_proposer',
  'permission_demander',
  'ecriture_avant'
])

/**
 * Outils ouverts à une session d'agent du pipeline (L2-pipeline-optimal D11) : lire la carte, les agents, le code et les
 * documents ; poser un widget relié à sa tâche. Rien d'autre n'écrit sur la carte.
 */
const PIPELINE_AGENT_TOOLS: ReadonlySet<McpToolName> = new Set([
  'etat',
  'carte_lire',
  'noeud_lire',
  'structure_lire',
  'code_graphe_lire',
  'document_lire',
  'agents_lire',
  'widget_poser'
])

/** Aiguillage des outils du pont : carte (spec 007) ou neurone de la conversation (spec 008). */
export function createToolHandler(
  map: Pick<MapService, 'handle'>,
  neurons: NeuronTools,
  structure: Pick<StructureService, 'draw' | 'read' | 'advance'>,
  plan: Pick<PlanTools, 'propose'>,
  documents: Pick<DocumentTools, 'write' | 'read'>,
  finals: Pick<FinalTools, 'propose'>,
  permissions?: Pick<PermissionService, 'request'>,
  deliverables?: Pick<DeliverableTracker, 'before'>,
  codeGraph?: Pick<CodeGraphTools, 'read'>,
  skills?: {
    readonly tools: Pick<SkillTools, 'read' | 'draft'>
    /** Conversation Skills (spec 020 H1) : seuls les outils des skills et les demandes de permission. */
    readonly isSkillsChat: (neuronId: string) => boolean
  },
  /** Garde d'écriture (conversation de codage de l'Analyste) : un message = écriture refusée. */
  writeGuard?: (neuronId: string, filePath: string) => string | null,
  /** Fiche d'un profil d'agent créé avec Claude (L1o D15). */
  agentProfiles?: Pick<AgentProfileTools, 'propose' | 'proposeSkills'>,
  /** Profils d'agents de toutes les sources, en lecture (L2-agents-lire.md). */
  agents?: Pick<AgentTools, 'read'>
): (tool: McpToolName, args: unknown, caller: McpCaller) => ToolResult | Promise<ToolResult> {
  return (tool, args, caller) => {
    if (caller.pipeline === true && !PIPELINE_AGENT_TOOLS.has(tool)) {
      throw new McpToolError(
        'NON_MODIFIABLE',
        `Un agent du pipeline lit la carte, les agents, le code et les documents, et pose un widget relié à sa tâche : ${tool} ne lui est pas ouvert.`
      )
    }
    if (caller.neuronId !== null && skills?.isSkillsChat(caller.neuronId) === true && !SKILLS_CHAT_TOOLS.has(tool)) {
      throw new McpToolError(
        'NON_MODIFIABLE',
        'Dans une conversation Skills, seuls skills_lire, agents_lire, skill_brouillon et agent_profil_proposer servent.'
      )
    }
    switch (tool) {
      case 'skills_lire':
        if (skills === undefined) throw new McpToolError('INTROUVABLE', 'Skills indisponibles.')
        return skills.tools.read((args as { skill?: string }).skill)
      case 'agents_lire':
        if (agents === undefined) throw new McpToolError('INTROUVABLE', 'Profils d’agents indisponibles.')
        return agents.read((args as { agent?: string }).agent, caller.neuronId)
      case 'skill_brouillon':
        if (skills === undefined) throw new McpToolError('INTROUVABLE', 'Skills indisponibles.')
        return skills.tools.draft(args as SkillBrouillonInput)
      case 'agent_profil_proposer':
        if (agentProfiles === undefined) throw new McpToolError('INTROUVABLE', 'Profils d’agents indisponibles.')
        return agentProfiles.propose(args as AgentProfilProposerInput, caller.neuronId)
      case 'agent_skills_proposer':
        if (agentProfiles === undefined) throw new McpToolError('INTROUVABLE', 'Profils d’agents indisponibles.')
        return agentProfiles.proposeSkills(args as AgentSkillsProposerInput, caller.neuronId)
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
      case 'ecriture_avant':
        // Hook de l’app (spec 014 R5) : seulement depuis une conversation du Brainstormer.
        if (caller.neuronId === null || deliverables === undefined) {
          throw new McpToolError('NON_MODIFIABLE', 'Hook d’écriture hors d’une conversation du Brainstormer.')
        }
        {
          const refusal = writeGuard?.(caller.neuronId, (args as EcritureAvantInput).file_path) ?? null
          if (refusal !== null) return { text: `${WRITE_REFUSED_PREFIX}${refusal}` }
        }
        return deliverables.before(caller.neuronId, args as EcritureAvantInput)
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
      case 'element_avancer':
        return structure.advance(args as ElementAvancerInput, caller)
      case 'structure_lire':
        return structure.read((args as { projet?: string }).projet, caller)
      case 'code_graphe_lire':
        if (codeGraph === undefined) throw new McpToolError('INTROUVABLE', 'Graphe mesuré indisponible.')
        return codeGraph.read((args as { projet?: string }).projet, caller)
      default:
        return map.handle(tool, args, caller)
    }
  }
}
