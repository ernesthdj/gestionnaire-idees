import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SkillInventory } from '../../../src/main/application/skills/SkillInventory'

const FIXTURES = resolve(__dirname, '../../fixtures/skills')

describe('inventaire des skills (spec 020 T006)', () => {
  let root: string
  let home: string
  let project: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'skills-'))
    home = join(root, 'home')
    project = join(root, 'projet')
    cpSync(join(FIXTURES, 'home'), home, { recursive: true })
    cpSync(join(FIXTURES, 'projet'), project, { recursive: true })
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const inventory = (): SkillInventory =>
    new SkillInventory({
      home,
      projects: () => [{ genesisId: 'g1', title: 'Recettes', dir: project }],
      now: () => 1000
    })

  it('should_list_one_node_per_skill_in_the_three_families', () => {
    const view = inventory().list()
    expect(view.skills.map((skill) => skill.id).sort()).toEqual([
      'perso:X_mauvais-nom',
      'perso:abime',
      'perso:graphify',
      'perso:hub',
      'perso:outil-script',
      'perso:professor',
      'plugin:demo-market/vercel-demo:deploy',
      'plugin:demo-market/vercel-demo:env',
      'projet:g1:journal'
    ])
    const byId = new Map(view.skills.map((skill) => [skill.id, skill]))
    expect(byId.get('perso:hub')).toMatchObject({ family: 'perso', origin: 'personnel', damaged: false })
    expect(byId.get('projet:g1:journal')?.origin).toBe('projet Recettes')
    // Seule la dernière version d'un plugin compte.
    expect(byId.get('plugin:demo-market/vercel-demo:deploy')).toMatchObject({
      origin: 'plugin vercel-demo 1.2.0',
      description: 'Déploiement fictif (version 1.2.0).'
    })
    expect(byId.get('perso:outil-script')?.hasScripts).toBe(true)
    expect(byId.get('perso:abime')?.damaged).toBe(true)
    expect(byId.get('perso:X_mauvais-nom')?.damaged).toBe(true)
    expect(JSON.stringify(view)).not.toContain(root)
  })

  it('should_link_hub_to_graphify_and_professor_and_journal_to_hub', () => {
    const links = inventory()
      .list()
      .links.map((link) => `${link.from} → ${link.to}`)
    expect(links).toEqual([
      'perso:hub → perso:graphify',
      'perso:hub → perso:professor',
      'projet:g1:journal → perso:hub'
    ])
  })

  it('should_give_the_markdown_and_files_of_a_skill_and_refuse_an_unknown_id', () => {
    const detail = inventory().get('perso:outil-script')
    expect(detail.markdown).toContain('Lance scripts/run.sh.')
    expect(detail.files.map((file) => [file.path, file.executable])).toEqual([
      ['SKILL.md', false],
      ['scripts/run.sh', true]
    ])
    expect(() => inventory().get('perso:inconnu')).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
  })

  it('should_ignore_a_link_that_leads_outside_the_skills_folder', () => {
    const outside = join(root, 'ailleurs', 'secret')
    mkdirSync(outside, { recursive: true })
    writeFileSync(join(outside, 'SKILL.md'), '---\nname: secret\ndescription: hors racine\n---\n')
    try {
      symlinkSync(outside, join(home, '.claude', 'skills', 'secret'), 'junction')
    } catch {
      return // Liens non autorisés sur ce poste : rien à vérifier.
    }
    expect(
      inventory()
        .list()
        .skills.some((skill) => skill.name === 'secret')
    ).toBe(false)
  })

  it('should_return_empty_families_when_folders_are_missing_and_mention_same_names', () => {
    const empty = new SkillInventory({ home: join(root, 'vide'), projects: () => [] })
    expect(empty.list().skills).toEqual([])
    mkdirSync(join(project, '.claude', 'skills', 'hub'))
    writeFileSync(join(project, '.claude', 'skills', 'hub', 'SKILL.md'), '---\nname: hub\ndescription: copie\n---\n')
    const view = inventory().list()
    expect(view.skills.find((skill) => skill.id === 'perso:hub')?.sameNameAs).toEqual(['projet:g1:hub'])
  })
})
