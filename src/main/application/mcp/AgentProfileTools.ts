import type { AgentProfileProposal, AgentProfileView, AgentSkillsProposal } from '@shared/agents/profile'
import type { ToolResult } from '@shared/mcp/protocol'
import type { AgentProfilProposerInput, AgentSkillsProposerInput } from '@shared/mcp/tools'
import { McpToolError } from '../../domain/mcp/errors'

export interface AgentProfileToolsDeps {
  /** La conversation est-elle une création de profil avec Claude (Skills › Profils d'agents) ? */
  readonly isProfileChat: (neuronId: string) => boolean
  /** Skills qu'un profil peut consulter : personnels et de projet (ceux de plugins se dupliquent d'abord). */
  readonly skillIds: () => ReadonlySet<string>
  readonly emit: (proposal: AgentProfileProposal) => void
  /** Profil de l'agent d'une conversation de visio (L1o D16) ; `undefined` : ce n'est pas une visio d'agent. */
  readonly agentOfChat?: (neuronId: string) => AgentProfileView | undefined
  readonly emitSkills?: (proposal: AgentSkillsProposal) => void
}

/**
 * Outil `agent_profil_proposer` (L1o D15) : Claude remplit la fiche du profil que mentalyas crée avec lui. Rien n'est
 * enregistré ; la fiche affichée à côté de la conversation reçoit les champs, marqués ✦, et mentalyas enregistre.
 */
export class AgentProfileTools {
  constructor(private readonly deps: AgentProfileToolsDeps) {}

  propose(input: AgentProfilProposerInput, neuronId: string | null): ToolResult {
    if (neuronId === null || !this.deps.isProfileChat(neuronId)) {
      throw new McpToolError(
        'NON_MODIFIABLE',
        'agent_profil_proposer ne sert que dans la conversation « Créer avec Claude » des profils d’agents.'
      )
    }
    const known = this.deps.skillIds()
    const unknown = (input.skills ?? []).filter((skill) => !known.has(skill))
    if (unknown.length > 0) {
      throw new McpToolError(
        'INTROUVABLE',
        `Skills inconnus ou de plugin : ${unknown.join(', ')}. Appelle skills_lire ; un skill de plugin se duplique d’abord.`
      )
    }
    const fields = {
      ...(input.nom === undefined ? {} : { name: input.nom }),
      ...(input.role === undefined ? {} : { role: input.role }),
      ...(input.consignes === undefined ? {} : { instructions: input.consignes }),
      ...(input.modele === undefined ? {} : { model: input.modele }),
      ...(input.effort === undefined ? {} : { effort: input.effort }),
      ...(input.permission === undefined ? {} : { permissionMode: input.permission }),
      ...(input.skills === undefined ? {} : { skills: [...new Set(input.skills)] })
    }
    this.deps.emit({ neuronId, fields, why: input.pourquoi ?? null })
    return {
      text:
        `Fiche remplie (${Object.keys(fields).join(', ')}). Rien n’est enregistré : mentalyas la voit à côté de la ` +
        'conversation, la retouche et clique « Enregistrer ».'
    }
  }

  /**
   * Outil `agent_skills_proposer` (L1o D16) : en visio, l'agent propose d'ajouter ou de retirer des skills de son
   * profil ; le volet de visio montre la proposition avec Accepter / Refuser. Rien n'est enregistré ici.
   */
  proposeSkills(input: AgentSkillsProposerInput, neuronId: string | null): ToolResult {
    const profile = neuronId === null ? undefined : this.deps.agentOfChat?.(neuronId)
    if (neuronId === null || profile === undefined || this.deps.emitSkills === undefined) {
      throw new McpToolError(
        'NON_MODIFIABLE',
        'agent_skills_proposer ne sert que dans ta visio d’agent avec mentalyas.'
      )
    }
    const known = this.deps.skillIds()
    const unknown = (input.ajouter ?? []).filter((skill) => !known.has(skill))
    if (unknown.length > 0) {
      throw new McpToolError(
        'INTROUVABLE',
        `Skills inconnus ou de plugin : ${unknown.join(', ')}. Appelle skills_lire ; un skill de plugin se duplique d’abord.`
      )
    }
    const add = [...new Set(input.ajouter ?? [])].filter((skill) => !profile.skills.includes(skill))
    const remove = [...new Set(input.retirer ?? [])].filter((skill) => profile.skills.includes(skill))
    if (add.length + remove.length === 0) {
      return { text: 'Rien à changer : ces skills sont déjà dans ton profil (ou n’y sont pas, pour les retirer).' }
    }
    this.deps.emitSkills({ neuronId, profileId: profile.id, add, remove, why: input.pourquoi })
    return {
      text:
        `Proposition envoyée (ajouter : ${add.join(', ') || 'rien'} ; retirer : ${remove.join(', ') || 'rien'}). ` +
        'mentalyas l’accepte ou la refuse dans le volet de visio ; ne la considère pas comme faite avant.'
    }
  }
}
