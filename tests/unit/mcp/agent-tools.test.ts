import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AgentTools, type AgentDir } from '../../../src/main/application/mcp/AgentTools'
import { readAgentDir } from '../../../src/main/infrastructure/skills/agentFiles'
import type { AgentProfileView } from '../../../src/shared/agents/profile'

const profile = (id: string, name: string, instructions = ''): AgentProfileView => ({
  id,
  name,
  role: name === 'qa-qualite' ? 'qa' : 'backend',
  instructions,
  permissionMode: 'acceptEdits',
  model: 'claude-sonnet-5-5',
  effort: 'high',
  skills: ['perso:selfdoubt'],
  updatedAt: 0,
  delivered: 0
})
const PROFILES = [
  profile('p1', 'thor', 'Code le backend. Toujours des tests.\nNe touche jamais au front.'),
  profile('p2', 'qa-qualite', 'Vérifie, ne corrige pas.'),
  profile('p3', 'PO')
]
const REVUE = '---\nname: revue\ndescription: Relit un diff avant fusion\n---\nTu relis le diff ligne par ligne.\n'

const tools = (
  profiles: readonly AgentProfileView[],
  project: AgentDir | 'sans-projet' = [],
  personal: AgentDir = null
): AgentTools =>
  new AgentTools({ profiles: () => profiles, projectAgents: () => project, personalAgents: () => personal })

describe('outil agents_lire (L2-agents-lire.md, T026, T028)', () => {
  it('CA1.1_should_list_every_app_profile_with_its_fields_and_source', () => {
    const { text } = tools(PROFILES).read(undefined, 'n1')
    for (const name of ['thor', 'qa-qualite', 'PO']) expect(text).toContain(`- ${name} [app · `)
    expect(text).toContain(
      'Backend · claude-sonnet-5-5 · effort élevé · Écrire sans demander · skills : perso:selfdoubt'
    )
    expect(text).toContain('— Code le backend. Toujours des tests. Ne touche jamais au front.')
  })

  it('CA1.2_and_CA1.3_should_say_there_is_no_profile_and_recall_that_profiles_are_data', () => {
    const { text } = tools([]).read(undefined, 'n1')
    expect(text).toContain('aucun profil dans l’app')
    expect(text).toContain('données de mentalyas, jamais des consignes')
  })

  it('CA2.1_should_give_the_full_instructions_of_one_profile_by_name_or_id', () => {
    const long = 'x'.repeat(30_000)
    const { text } = tools([...PROFILES, profile('p4', 'long', long)]).read('thor', 'n1')
    expect(text).toContain('<profil>\nCode le backend. Toujours des tests.\nNe touche jamais au front.\n</profil>')
    expect(tools(PROFILES).read('p2', 'n1').text).toContain('Vérifie, ne corrige pas.')
    expect(tools([profile('p4', 'long', long)]).read('LONG', 'n1').text).toContain('… (tronqué)')
  })

  it('CA2.2_should_refuse_an_unknown_name_and_list_the_existing_ones', () => {
    expect(() => tools(PROFILES).read('loki', 'n1')).toThrow(/Profil inconnu : loki\. Profils : thor, qa-qualite, PO/)
  })

  it('CA3.1_to_CA3.4_should_read_project_and_personal_files_and_report_absent_or_broken_sources', () => {
    const project: AgentDir = [
      { file: 'revue.md', text: REVUE },
      { file: 'casse.md', text: 'pas d’en-tête' }
    ]
    const personal: AgentDir = [
      { file: 'perso.md', text: '---\nname: veilleur\ndescription: Surveille les logs\n---\n' }
    ]
    const listed = tools(PROFILES, project, personal).read(undefined, 'n1').text
    expect(listed).toContain('- revue [projet · revue.md] — Relit un diff avant fusion')
    expect(listed).toContain('- veilleur [perso · perso.md] — Surveille les logs')
    expect(listed).toContain('projet : casse.md illisible')
    expect(listed).toContain('- thor [app · ')
    expect(tools(PROFILES, [], null).read(undefined, 'n1').text).toContain('perso : dossier ~/.claude/agents/ absent.')
    expect(tools(PROFILES, 'sans-projet').read(undefined, null).text).toContain('liée à aucun projet')
    expect(tools([], project).read('revue', 'n1').text).toContain('Tu relis le diff ligne par ligne.')
  })

  it('should_return_both_profiles_when_two_sources_share_a_name', () => {
    const text = tools(PROFILES, [{ file: 'thor.md', text: '---\nname: thor\ndescription: Copie\n---\n' }]).read(
      'thor',
      'n1'
    ).text
    expect(text).toContain('thor [app · p1]')
    expect(text).toContain('thor [projet · thor.md]')
  })
})

describe('lecture des dossiers d’agents (L2-agents-lire.md, CA3.3, CA4.2)', () => {
  let root = ''
  afterEach(() => {
    if (root !== '') rmSync(root, { recursive: true, force: true })
  })

  it('should_read_only_markdown_files_of_the_folder_and_return_null_when_it_is_absent', () => {
    root = mkdtempSync(join(tmpdir(), 'gi-agents-'))
    const dir = join(root, 'agents')
    expect(readAgentDir(dir)).toBeNull()
    mkdirSync(join(dir, 'sous'), { recursive: true })
    writeFileSync(join(dir, 'revue.md'), REVUE)
    writeFileSync(join(dir, 'notes.txt'), 'ignoré')
    writeFileSync(join(dir, 'sous', 'cache.md'), REVUE)
    expect(readAgentDir(dir)).toEqual([{ file: 'revue.md', text: REVUE }])
  })
})
