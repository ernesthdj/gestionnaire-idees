import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PipelineDocuments } from '../../../src/main/application/agents/PipelineDocuments'
import type { AgentProfileView } from '../../../src/shared/agents/profile'
import { matchRecommended, parseSpecAgents, profileCatalog } from '../../../src/shared/agents/recommendation'

const profile = (over: Partial<AgentProfileView>): AgentProfileView => ({
  id: 'p1',
  name: 'Dev back',
  role: 'backend',
  instructions: 'Code le serveur.\nTests d’abord.',
  permissionMode: 'bypassPermissions',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  skills: ['perso:tdd'],
  updatedAt: 0,
  ...over
})

const SPEC = `# Spec
Objectif…

- RECOMMANDÉ: Dev back — la tâche touche l'API
RECOMMANDE: QA strict - tests de non-régression
SUGGÉRÉ: Auditeur SQL | autre | Relis les migrations et leurs down | perso:sql, perso:revue
SUGGERE: Sans consignes | backend |  |
RECOMMANDÉ: Dev back — doublon
ligne libre
`

describe('agents recommandés par le PO', () => {
  it('should_read_recommended_and_suggested_agents_when_the_spec_lists_them', () => {
    const agents = parseSpecAgents(SPEC)
    expect(agents.recommended).toEqual([
      { profile: 'Dev back', reason: "la tâche touche l'API" },
      { profile: 'QA strict', reason: 'tests de non-régression' }
    ])
    expect(agents.suggested).toEqual([
      {
        name: 'Auditeur SQL',
        role: 'autre',
        instructions: 'Relis les migrations et leurs down',
        skills: ['perso:sql', 'perso:revue']
      }
    ])
  })

  it('should_fall_back_to_the_other_role_when_the_suggested_role_is_unknown', () => {
    const [agent] = parseSpecAgents('SUGGÉRÉ: Rédacteur | scribe | Écris la doc | ').suggested
    expect(agent).toMatchObject({ role: 'autre', skills: [] })
    expect(parseSpecAgents('SUGGÉRÉ: A | Product Owner | x | ').suggested[0]?.role).toBe('po')
  })

  it('should_return_nothing_when_the_spec_has_no_agent_line', () => {
    expect(parseSpecAgents('Une spec sans liste.')).toEqual({ recommended: [], suggested: [] })
  })

  it('should_separate_known_profiles_from_unknown_names', () => {
    const { known, unknown } = matchRecommended(parseSpecAgents(SPEC), [profile({})])
    expect(known.map((r) => r.profile)).toEqual(['Dev back'])
    expect(unknown.map((r) => r.profile)).toEqual(['QA strict'])
  })

  it('should_describe_existing_profiles_for_the_po', () => {
    expect(profileCatalog([])).toMatch(/Aucun profil/)
    const text = profileCatalog([profile({}), profile({ id: 'p2', name: 'QA', role: 'qa', skills: [] })])
    expect(text).toContain(
      '- Dev back (Backend, claude-sonnet-5-5, effort medium, skills : perso:tdd) — Code le serveur. Tests d’abord.'
    )
    expect(text).toContain('- QA (QA, claude-sonnet-5-5, effort medium, aucun skill)')
  })
})

describe('spec signée et agents recommandés', () => {
  let root: string
  let docs: PipelineDocuments
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-reco-'))
    docs = new PipelineDocuments({
      projectDir: join(root, 'projet'),
      profileDir: join(root, 'profil'),
      projectName: 'demo'
    })
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('should_keep_the_agents_when_the_spec_is_written_and_read_back', () => {
    const written = docs.writeSpec('T009', 'po', SPEC)
    expect(written.agents.recommended).toHaveLength(2)
    expect(docs.readSpec('T009')?.agents).toEqual(written.agents)
  })
})
