import { describe, expect, it } from 'vitest'
import {
  AgentChats,
  agentChatKey,
  agentPersona,
  parseAgentChatKey
} from '../../../src/main/application/agents/AgentChats'
import type { AgentProfileView } from '../../../src/shared/agents/profile'
import type { AssemblySketchView } from '../../../src/shared/ipc/assemblies'

const G = '22222222-2222-4222-8222-222222222222'
const HOST = `wf:${G}:ttask:tri-t001`
const PROFILE: AgentProfileView = {
  id: 'p-back',
  name: 'Développeur',
  role: 'backend',
  instructions: 'Toujours des tests.',
  permissionMode: 'bypassPermissions',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  skills: [],
  updatedAt: 0,
  delivered: 0
}
const SKETCH: AssemblySketchView = {
  nodeId: HOST,
  genesisId: G,
  taskId: 'T-1',
  agents: [{ id: 'back', profileId: 'p-back' }],
  links: []
}

const setup = () => {
  const rows: { id: string; genesisId: string; key: string; title: string; kind: string }[] = []
  let next = 0
  const chats = new AgentChats({
    repository: {
      chatOf: (genesisId, key, kind) =>
        rows.find((row) => row.genesisId === genesisId && row.key === key && row.kind === kind)?.id,
      insert: (row) => rows.push(row)
    },
    sketches: () => [SKETCH],
    profile: (id) => (id === PROFILE.id ? PROFILE : undefined),
    linkedGenesis: (id) => id === G,
    newId: () => `chat-${++next}`
  })
  return { chats, rows }
}

describe('visio avec un agent (L1o D13)', () => {
  it('should_create_the_agent_chat_once_then_resume_it_when_called_again', () => {
    const { chats, rows } = setup()
    expect(chats.open(HOST, 'back')).toEqual({ neuronId: 'chat-1' })
    expect(chats.open(HOST, 'back')).toEqual({ neuronId: 'chat-1' })
    expect(rows).toEqual([
      { id: 'chat-1', genesisId: G, key: agentChatKey(HOST, 'back'), title: 'Développeur', kind: 'agent_chat' }
    ])
  })

  it('should_refuse_when_the_agent_left_the_node_or_the_project_is_not_linked', () => {
    const { chats } = setup()
    expect(() => chats.open(HOST, 'qa')).toThrow(/plus connecté/)
    expect(() => chats.open(`wf:33333333-3333-4333-8333-333333333333:ttask:x`, 'back')).toThrow(/introuvable/)
  })

  it('should_read_back_the_node_and_the_agent_when_parsing_a_chat_key', () => {
    expect(parseAgentChatKey(agentChatKey(HOST, 'back'))).toEqual({ hostId: HOST, agentId: 'back' })
    expect(parseAgentChatKey('wf:x')).toBeNull()
  })

  it('should_keep_the_profile_mode_and_carry_instructions_and_task_when_building_the_persona', () => {
    const persona = agentPersona({
      profile: PROFILE,
      hostTitle: 'T001 · Trier',
      hostContext: '- src/a.ts',
      worktree: null
    })
    // Le mode du profil, tel quel (L1o D19) : la conversation n'applique Libre qu'une fois confirmé.
    expect(persona.permissionMode).toBe('bypassPermissions')
    expect(persona.model).toBe('claude-sonnet-5-5')
    expect(persona.cwd).toBeNull()
    expect(persona.systemPrompt).toContain('« Développeur », agent Backend')
    expect(persona.systemPrompt).toContain('« T001 · Trier »')
    expect(persona.systemPrompt).toContain('Toujours des tests.')
    expect(persona.systemPrompt).toContain('- src/a.ts')
  })
})
