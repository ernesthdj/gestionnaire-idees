import { describe, expect, it } from 'vitest'
import { AgentBench, BENCH_MAX } from '../../../src/main/application/agents/AgentBench'
import type { BenchAgentView } from '../../../src/shared/ipc/assemblies'

const G = '22222222-2222-4222-8222-222222222222'

const setup = () => {
  const rows = new Map<string, BenchAgentView>()
  let next = 0
  const bench = new AgentBench({
    repository: {
      list: (genesisId) => [...rows.values()].filter((row) => row.genesisId === genesisId),
      find: (id) => rows.get(id),
      save: (agent) => void rows.set(agent.id, agent),
      remove: (id) => void rows.delete(id)
    },
    profileExists: (id) => id === 'p-dev',
    projectExists: (id) => id === G,
    newId: () => `b${++next}`
  })
  return { bench, rows }
}

describe('agents posés libres sur la carte (L1o D26, T030)', () => {
  it('should_place_move_and_remove_a_free_agent_with_rounded_coordinates', () => {
    const { bench } = setup()
    expect(bench.place(G, 'p-dev', 10.4, -3.6)).toEqual({ id: 'b1', genesisId: G, profileId: 'p-dev', x: 10, y: -4 })
    expect(bench.move('b1', 200.6, 50)).toMatchObject({ x: 201, y: 50 })
    expect(bench.list(G)).toHaveLength(1)
    bench.remove('b1')
    expect(bench.list(G)).toEqual([])
  })

  it('should_refuse_an_unknown_profile_project_or_agent_and_a_crowded_map', () => {
    const { bench } = setup()
    expect(() => bench.place(G, 'inconnu', 0, 0)).toThrow(/profil/)
    expect(() => bench.place('autre', 'p-dev', 0, 0)).toThrow(/Projet introuvable/)
    expect(() => bench.move('absent', 0, 0)).toThrow(/plus sur la carte/)
    for (let i = 0; i < BENCH_MAX; i++) bench.place(G, 'p-dev', i, 0)
    expect(() => bench.place(G, 'p-dev', 0, 0)).toThrow(/Trop d’agents libres/)
  })
})
