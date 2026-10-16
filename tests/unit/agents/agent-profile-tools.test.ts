import { describe, expect, it } from 'vitest'
import { AgentProfileTools } from '../../../src/main/application/mcp/AgentProfileTools'
import type { AgentProfileProposal, AgentProfileView, AgentSkillsProposal } from '../../../src/shared/agents/profile'
import { AgentProfilProposerInput } from '../../../src/shared/mcp/tools'

const AGENT = { id: 'p-qa', name: 'Qualité', skills: ['perso:revue'] } as unknown as AgentProfileView

const setup = () => {
  const sent: AgentProfileProposal[] = []
  const skills: AgentSkillsProposal[] = []
  const tools = new AgentProfileTools({
    isProfileChat: (neuronId) => neuronId === 'profil',
    skillIds: () => new Set(['perso:tests', 'perso:revue']),
    emit: (proposal) => sent.push(proposal),
    agentOfChat: (neuronId) => (neuronId === 'visio' ? AGENT : undefined),
    emitSkills: (proposal) => skills.push(proposal)
  })
  return { tools, sent, skills }
}

describe('fiche d’un profil d’agent remplie par Claude (L1o D15)', () => {
  it('should_send_the_given_fields_to_the_open_form_when_claude_proposes', () => {
    const { tools, sent } = setup()
    const result = tools.propose(
      { nom: 'Chef QA', role: 'qa', skills: ['perso:tests', 'perso:tests'], pourquoi: 'Il vérifie les tests.' },
      'profil'
    )
    expect(sent).toEqual([
      {
        neuronId: 'profil',
        fields: { name: 'Chef QA', role: 'qa', skills: ['perso:tests'] },
        why: 'Il vérifie les tests.'
      }
    ])
    expect(result.text).toContain('Rien n’est enregistré')
  })

  it('should_refuse_outside_the_profile_conversation_or_with_an_unknown_skill', () => {
    const { tools, sent } = setup()
    expect(() => tools.propose({ nom: 'X' }, 'autre')).toThrow(/Créer avec Claude/)
    expect(() => tools.propose({ nom: 'X' }, null)).toThrow(/Créer avec Claude/)
    expect(() => tools.propose({ skills: ['plugin:x:y'] }, 'profil')).toThrow(/plugin:x:y/)
    expect(sent).toEqual([])
  })

  it('should_reject_an_empty_proposal_or_a_closed_list_value_when_validating_the_input', () => {
    expect(AgentProfilProposerInput.safeParse({}).success).toBe(false)
    expect(AgentProfilProposerInput.safeParse({ pourquoi: 'rien' }).success).toBe(false)
    expect(AgentProfilProposerInput.safeParse({ role: 'chef' }).success).toBe(false)
    expect(AgentProfilProposerInput.safeParse({ modele: 'gpt' }).success).toBe(false)
    expect(AgentProfilProposerInput.safeParse({ effort: 'high', permission: 'acceptEdits' }).success).toBe(true)
  })
})

describe('skills d’un agent peaufinés en visio (L1o D16)', () => {
  it('should_send_only_real_changes_to_the_visio_panel_when_the_agent_proposes', () => {
    const { tools, skills } = setup()
    const result = tools.proposeSkills(
      { ajouter: ['perso:tests', 'perso:revue'], retirer: ['perso:revue', 'perso:tests'], pourquoi: 'Plus de tests.' },
      'visio'
    )
    // « revue » est déjà là (rien à ajouter) ; « tests » n'y est pas (rien à retirer).
    expect(skills).toEqual([
      { neuronId: 'visio', profileId: 'p-qa', add: ['perso:tests'], remove: ['perso:revue'], why: 'Plus de tests.' }
    ])
    expect(result.text).toContain('l’accepte ou la refuse')
  })

  it('should_refuse_outside_an_agent_visio_or_with_an_unknown_skill_and_say_when_nothing_changes', () => {
    const { tools, skills } = setup()
    expect(() => tools.proposeSkills({ ajouter: ['perso:tests'], pourquoi: 'x' }, 'profil')).toThrow(/visio/)
    expect(() => tools.proposeSkills({ ajouter: ['plugin:a:b'], pourquoi: 'x' }, 'visio')).toThrow(/plugin:a:b/)
    expect(tools.proposeSkills({ ajouter: ['perso:revue'], pourquoi: 'x' }, 'visio').text).toContain('Rien à changer')
    expect(skills).toEqual([])
  })
})
