import { describe, expect, it } from 'vitest'
import { strayTeams } from '../../../src/renderer/src/canvas/agents/teamTargets'
import type { AssemblySketchView } from '../../../src/shared/ipc/assemblies'
import type { WorkflowView } from '../../../src/shared/ipc/workflow'

const G = '22222222-2222-4222-8222-222222222222'
const EMPTY = {
  genesisId: G,
  specs: [],
  brainstorm: [],
  taskFiles: [],
  foundation: null,
  tree: { roots: [], next: null, complete: null },
  folded: {},
  empty: true,
  missingFiles: [],
  readAt: ''
} as unknown as WorkflowView

const team = (nodeId: string, genesisId = G): AssemblySketchView => ({
  nodeId,
  genesisId,
  taskId: 'T-1',
  agents: [{ id: 'po', profileId: 'p' }],
  links: []
})

describe('équipes dont le nœud a disparu (L1o D27)', () => {
  it('should_flag_a_workflow_team_whose_node_is_no_longer_read_in_this_project_only', () => {
    const gone = team(`wf:${G}:ttask:fabc-ancien`)
    const other = team('wf:33333333-3333-4333-8333-333333333333:ttask:x', '33333333-3333-4333-8333-333333333333')
    const empty = { ...team(`wf:${G}:ttask:vide`), agents: [] }
    expect(strayTeams(EMPTY, G, [gone, other, empty])).toEqual([gone])
  })
})
