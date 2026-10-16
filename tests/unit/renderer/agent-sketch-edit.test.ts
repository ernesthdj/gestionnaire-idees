import { describe, expect, it } from 'vitest'
import {
  addAgent,
  addLink,
  agentIdFor,
  defaultTaskId,
  editAgent,
  emptySketch,
  parseZone,
  placeAgent,
  removeAgent,
  removeLink,
  waitableBy
} from '../../../src/renderer/src/canvas/agents/sketchEdit'
import { isValidAgentId } from '../../../src/shared/agents/pipeline'
import { isValidTaskId } from '../../../src/shared/agents/documents'
import type { AgentProfileView } from '../../../src/shared/agents/profile'

const NODE = '3f2b8a10-5c4d-4e6f-9a7b-1c2d3e4f5a6b'
const profile = (name: string): AgentProfileView => ({
  id: `p-${name}`,
  name,
  role: 'backend',
  instructions: '',
  permissionMode: 'acceptEdits',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  skills: [],
  updatedAt: 0,
  delivered: 0
})

describe('édition du croquis des agents d’un nœud (T006)', () => {
  it('should_build_a_valid_unique_agent_id_from_the_profile_name', () => {
    expect(agentIdFor('Développeur Back-end', new Set())).toBe('developpeur-back-end')
    expect(agentIdFor('Développeur Back-end', new Set(['developpeur-back-end']))).toBe('developpeur-back-end-2')
    expect(agentIdFor('!!!', new Set())).toBe('agent')
    const long = agentIdFor('x'.repeat(80), new Set(['x'.repeat(28)]))
    expect(isValidAgentId(long)).toBe(true)
    expect(isValidAgentId(agentIdFor('QA', new Set()))).toBe(true)
  })

  it('should_propose_a_valid_task_id_for_a_node', () => {
    expect(isValidTaskId(defaultTaskId(NODE))).toBe(true)
    expect(defaultTaskId(NODE)).toBe('T-3f2b8a10')
    const task = 'wf:22222222-2222-4222-8222-222222222222:ttask:docs-taches-tri-t001'
    expect(defaultTaskId(task)).toBe('T-ttaskdocstachestrit001')
    expect(isValidTaskId(defaultTaskId(task))).toBe(true)
  })

  it('should_add_two_agents_of_the_same_profile_with_distinct_ids', () => {
    let sketch = emptySketch(NODE, 'g')
    sketch = addAgent(profile('Back'))(sketch)
    sketch = addAgent(profile('Back'))(sketch)
    expect(sketch.agents.map((agent) => agent.id)).toEqual(['back', 'back-2'])
    expect(sketch.agents.every((agent) => agent.profileId === 'p-Back')).toBe(true)
  })

  it('should_drop_the_links_of_a_removed_agent', () => {
    let sketch = emptySketch(NODE, 'g')
    for (const name of ['po', 'back', 'qa']) sketch = addAgent(profile(name))(sketch)
    sketch = addLink('po', 'back')(addLink('back', 'qa')(sketch))
    expect(removeAgent('back')(sketch)).toMatchObject({ links: [] })
    expect(removeAgent('back')(sketch).agents.map((agent) => agent.id)).toEqual(['po', 'qa'])
  })

  it('should_ignore_a_duplicate_link_a_self_link_and_a_link_that_closes_a_loop', () => {
    let sketch = emptySketch(NODE, 'g')
    for (const name of ['po', 'back', 'qa']) sketch = addAgent(profile(name))(sketch)
    sketch = addLink('back', 'qa')(addLink('po', 'back')(sketch))
    expect(addLink('po', 'back')(sketch)).toBe(sketch)
    expect(addLink('po', 'po')(sketch)).toBe(sketch)
    expect(addLink('qa', 'po')(sketch)).toBe(sketch)
    expect(removeLink('po', 'back')(sketch).links).toEqual([{ from: 'back', to: 'qa' }])
  })

  it('should_offer_only_the_agents_that_can_still_be_waited_for', () => {
    let sketch = emptySketch(NODE, 'g')
    for (const name of ['po', 'back', 'qa']) sketch = addAgent(profile(name))(sketch)
    sketch = addLink('po', 'back')(sketch)
    expect(waitableBy(sketch, 'back')).toEqual(['qa'])
    expect(waitableBy(sketch, 'po')).toEqual(['qa'])
    expect(waitableBy(sketch, 'qa')).toEqual(['po', 'back'])
  })

  it('should_set_and_clear_the_task_and_the_zone_of_one_agent_only', () => {
    let sketch = emptySketch(NODE, 'g')
    for (const name of ['po', 'back']) sketch = addAgent(profile(name))(sketch)
    sketch = editAgent('back', { task: 'Trier', zone: ['src/liste'] })(sketch)
    expect(sketch.agents).toEqual([
      { id: 'po', profileId: 'p-po' },
      { id: 'back', profileId: 'p-back', task: 'Trier', zone: ['src/liste'] }
    ])
    sketch = editAgent('back', { task: '  ' })(sketch)
    expect(sketch.agents[1]).toEqual({ id: 'back', profileId: 'p-back', zone: ['src/liste'] })
    expect(editAgent('back', { zone: [] })(sketch).agents[1]).toEqual({ id: 'back', profileId: 'p-back' })
  })

  it('should_place_one_agent_rounded_and_keep_its_place_when_its_part_is_edited', () => {
    let sketch = emptySketch(NODE, 'g')
    for (const name of ['po', 'back']) sketch = addAgent(profile(name))(sketch)
    sketch = placeAgent('back', { x: 120.4, y: -39.6 })(sketch)
    expect(sketch.agents).toEqual([
      { id: 'po', profileId: 'p-po' },
      { id: 'back', profileId: 'p-back', place: { x: 120, y: -40 } }
    ])
    expect(editAgent('back', { task: 'Trier' })(sketch).agents[1]).toEqual({
      id: 'back',
      profileId: 'p-back',
      task: 'Trier',
      place: { x: 120, y: -40 }
    })
  })

  it('should_read_a_zone_one_path_per_line_or_comma_separated', () => {
    expect(parseZone('src/a, src/b\n\n  docs  \n')).toEqual(['src/a', 'src/b', 'docs'])
    expect(parseZone('  ')).toEqual([])
  })
})
