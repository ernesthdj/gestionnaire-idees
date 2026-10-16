import { describe, expect, it } from 'vitest'
import {
  agentBranch,
  assemblyError,
  topologicalOrder,
  zoneOverlapWarning,
  zoneOverlaps,
  type Assembly,
  type ZoneOverlap
} from '../../../src/shared/agents/pipeline'
import type { AgentRole } from '../../../src/shared/agents/profile'

const ROLES: Readonly<Record<string, AgentRole>> = { po: 'po', back: 'backend', front: 'frontend', qa: 'qa' }
const roleOf = (id: string): AgentRole | undefined => ROLES[id]

const assembly = (ids: readonly string[], links: readonly (readonly [string, string])[]): Assembly => ({
  taskId: 'T010',
  brief: 'Faire X',
  agents: ids.map((id) => ({ id, profileId: id })),
  links: links.map(([from, to]) => ({ from, to }))
})

describe('règles d’un assemblage d’agents (L1o D1, D2, D12)', () => {
  it('should_accept_a_single_agent_without_po', () => {
    expect(assemblyError(assembly(['back'], []), roleOf)).toBeNull()
  })

  it('should_accept_parallel_agents_that_all_lead_back_to_the_po', () => {
    const ok = assembly(
      ['po', 'back', 'front', 'qa'],
      [
        ['po', 'back'],
        ['po', 'front'],
        ['back', 'qa'],
        ['front', 'qa']
      ]
    )
    expect(assemblyError(ok, roleOf)).toBeNull()
    expect(topologicalOrder(ok)).toEqual(['po', 'back', 'front', 'qa'])
  })

  it.each([
    ['no agent', assembly([], []), /aucun agent/],
    ['an invalid id', assembly(['Back!'], []), /invalide/],
    ['a duplicated id', assembly(['back', 'back'], []), /Deux agents/],
    ['an agent without profile', assembly(['inconnu'], []), /pas de profil/],
    ['a link to an absent agent', assembly(['back'], [['back', 'qa']]), /absent/],
    ['a self link', assembly(['back'], [['back', 'back']]), /lui-même/],
    [
      'a duplicated link',
      assembly(
        ['po', 'back'],
        [
          ['po', 'back'],
          ['po', 'back']
        ]
      ),
      /double/
    ],
    [
      'a cycle',
      assembly(
        ['po', 'back', 'qa'],
        [
          ['po', 'back'],
          ['back', 'qa'],
          ['qa', 'back']
        ]
      ),
      /boucle/
    ],
    ['several agents without po', assembly(['back', 'front'], [['back', 'front']]), /Product Owner, et un seul/],
    ['a po waiting for an agent', assembly(['po', 'back'], [['back', 'po']]), /n’attend aucun agent/],
    ['an agent cut off from the po', assembly(['po', 'back', 'front'], [['po', 'back']]), /« front » n’est pas relié/]
  ])('should_refuse_an_assembly_when_it_has_%s', (_label, value, message) => {
    expect(assemblyError(value, roleOf)).toMatch(message)
  })

  it('should_name_each_agent_branch_after_its_task_and_id', () => {
    expect(agentBranch('T010', 'back-2')).toBe('agents/T010/back-2')
  })
})

describe('zones de travail (L1o D4)', () => {
  const withZones = (
    zones: Readonly<Record<string, readonly string[]>>,
    links: readonly (readonly [string, string])[] = [
      ['po', 'back'],
      ['po', 'front']
    ]
  ): Assembly => ({
    ...assembly(['po', 'back', 'front'], links),
    agents: ['po', 'back', 'front'].map((id) => ({ id, profileId: id, ...(zones[id] ? { zone: zones[id] } : {}) }))
  })

  it('should_report_parallel_agents_whose_zones_overlap_and_suggest_a_link', () => {
    const overlaps = zoneOverlaps(withZones({ back: ['src/main'], front: ['src/main/ui/', 'src/renderer'] }))
    expect(overlaps).toEqual([
      { first: 'back', second: 'front', paths: ['src/main/ui'], suggestedLink: { from: 'back', to: 'front' } }
    ])
    expect(zoneOverlapWarning(overlaps[0] as ZoneOverlap)).toContain('Relier back → front')
  })

  it('should_not_report_agents_with_disjoint_zones_or_without_zone', () => {
    expect(zoneOverlaps(withZones({ back: ['src/main'], front: ['src/mainframe'] }))).toEqual([])
    expect(zoneOverlaps(withZones({ back: ['src'] }))).toEqual([])
  })

  it('should_not_report_agents_already_in_sequence', () => {
    const linked = withZones({ back: ['src'], front: ['src'] }, [
      ['po', 'back'],
      ['back', 'front']
    ])
    expect(zoneOverlaps(linked)).toEqual([])
  })

  it('should_report_an_overlap_when_the_paths_differ_only_by_case', () => {
    expect(zoneOverlaps(withZones({ back: ['src/App'], front: ['src/app/ui'] }))[0]?.paths).toEqual(['src/app/ui'])
  })

  it('should_treat_dot_as_the_whole_project', () => {
    expect(zoneOverlaps(withZones({ back: ['.'], front: ['docs\\a.md'] }))[0]?.paths).toEqual(['docs/a.md'])
  })

  it.each([['/etc'], ['C:\\x'], ['../autre'], ['a/../b'], ['  ']])(
    'should_refuse_the_zone_%s_when_it_leaves_the_project',
    (path) => {
      expect(assemblyError(withZones({ back: [path] }), roleOf)).toMatch(/Zone invalide/)
    }
  )
})
