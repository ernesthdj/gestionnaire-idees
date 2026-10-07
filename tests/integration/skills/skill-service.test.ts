import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { SkillInventory } from '../../../src/main/application/skills/SkillInventory'
import { SkillService } from '../../../src/main/application/skills/SkillService'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { SkillRepository } from '../../../src/main/infrastructure/db/repositories/SkillRepository'
import { SkillStore } from '../../../src/main/infrastructure/skills/SkillStore'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const FIXTURES = resolve(import.meta.dirname, '../../fixtures/skills')

describe('faire évoluer ses skills (spec 020 US3, T021–T022b)', () => {
  let root: string
  let home: string
  let handle: DatabaseHandle
  let skills: SkillService
  let history: HistoryService
  let changes: number
  let clock: number

  const hubFile = (): string => join(home, '.claude', 'skills', 'hub', 'SKILL.md')
  const read = (path: string): string => readFileSync(path, 'utf8')

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'skills-svc-'))
    home = join(root, 'home')
    cpSync(join(FIXTURES, 'home'), home, { recursive: true })
    handle = openDatabase({ file: join(root, 'a.db'), key: '5'.repeat(64), migrationsFolder: MIGRATIONS })
    const projects = (): [] => []
    const inventory = new SkillInventory({ home, projects })
    changes = 0
    clock = 1_000
    skills = new SkillService({
      repository: new SkillRepository(handle.db),
      store: new SkillStore(join(root, 'profil', 'skill-versions')),
      inventory,
      home,
      projects,
      onChanged: () => (changes += 1),
      now: () => (clock += 1)
    })
    history = new HistoryService(new HistoryRepository(handle.db), skills.historyHandlers())
  })
  afterEach(() => {
    handle.close()
    rmSync(root, { recursive: true, force: true })
  })

  const claudeDraft = (extra: Record<string, unknown> = {}) =>
    skills.writeDraft({
      skill: 'hub',
      famille: 'perso',
      description: 'Archiviste fictif, déclencheurs plus clairs',
      contenu: '# Hub (fictif)\n\nUtilise-le en fin de session.\n',
      ...extra
    })

  it('should_write_nothing_on_disk_when_claude_drafts_an_improvement', () => {
    const original = read(hubFile())
    const { draftId, created } = claudeDraft()
    expect(created).toBe(true)
    expect(read(hubFile())).toBe(original)
    const diff = skills.diff(draftId)
    expect(diff.diskChanged).toBe(false)
    expect(diff.files[0]).toMatchObject({ path: 'SKILL.md', status: 'modifie' })
    expect(skills.drafts('perso:hub').map((draft) => draft.origin)).toEqual(['claude'])
    expect(history.list().items[0]).toMatchObject({ actor: 'claude', summary: 'Brouillon de skill « hub »' })
  })

  it('should_install_then_restore_the_exact_original_content', () => {
    const original = read(hubFile())
    const { draftId } = claudeDraft()
    skills.install(draftId)
    expect(read(hubFile())).toContain('description: "Archiviste fictif, déclencheurs plus clairs"')
    expect(history.list().items[0]?.summary).toBe('Skill « hub » mis à jour')
    skills.restore('perso:hub')
    expect(read(hubFile())).toBe(original)
  })

  it('should_undo_an_installation_from_the_history', () => {
    const original = read(hubFile())
    const { batchId } = skills.install(claudeDraft().draftId)
    history.undo(batchId)
    expect(read(hubFile())).toBe(original)
  })

  it('should_refuse_to_install_over_a_skill_changed_on_disk_unless_confirmed', () => {
    const { draftId } = claudeDraft()
    writeFileSync(hubFile(), `${read(hubFile())}\nModifié ailleurs.\n`)
    expect(() => skills.install(draftId)).toThrow(expect.objectContaining({ code: 'DISK_CHANGED' }))
    expect(skills.diff(draftId).diskChanged).toBe(true)
    skills.install(draftId, true)
    expect(read(hubFile())).toContain('déclencheurs plus clairs')
  })

  it('should_create_a_new_skill_and_refuse_a_name_already_taken', () => {
    const { draftId } = skills.writeDraft({
      skill: 'nouveau',
      famille: 'perso',
      description: 'Skill fictif neuf',
      contenu: 'Corps',
      annexes: [{ chemin: 'exemples/a.md', contenu: 'Exemple' }]
    })
    expect(skills.drafts().find((draft) => draft.id === draftId)?.isNew).toBe(true)
    skills.install(draftId)
    expect(read(join(home, '.claude', 'skills', 'nouveau', 'exemples', 'a.md'))).toBe('Exemple')
    // Un dossier du même nom apparu entre-temps : jamais écrasé.
    const late = skills.writeDraft({ skill: 'zeta', famille: 'perso', description: 'x', contenu: 'y' })
    cpSync(join(home, '.claude', 'skills', 'hub'), join(home, '.claude', 'skills', 'zeta'), { recursive: true })
    expect(() => skills.install(late.draftId)).toThrow(expect.objectContaining({ code: 'NAME_TAKEN' }))
  })

  it('should_remove_a_skill_and_bring_it_back_identical_by_undo', () => {
    const original = read(hubFile())
    const { batchId } = skills.remove('perso:hub')
    expect(existsSync(join(home, '.claude', 'skills', 'hub'))).toBe(false)
    expect(history.list().items[0]?.summary).toBe('Skill « hub » supprimé')
    history.undo(batchId)
    expect(read(hubFile())).toBe(original)
  })

  it('should_refuse_executables_bad_paths_names_and_plugin_writes', () => {
    expect(() => claudeDraft({ annexes: [{ chemin: 'scripts/run.sh', contenu: 'echo' }] })).toThrow(
      expect.objectContaining({ code: 'VALIDATION' })
    )
    expect(() => claudeDraft({ annexes: [{ chemin: '../../evil.md', contenu: 'x' }] })).toThrow(
      expect.objectContaining({ code: 'VALIDATION' })
    )
    expect(() => claudeDraft({ skill: '../hub' })).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
    expect(() => skills.remove('plugin:demo-market/vercel-demo:deploy')).toThrow(
      expect.objectContaining({ code: 'READ_ONLY_FAMILY' })
    )
    expect(() => skills.restore('perso:hub')).toThrow(expect.objectContaining({ code: 'NO_VERSION' }))
  })

  it('should_duplicate_a_plugin_skill_as_a_personal_draft', () => {
    const { draftId } = skills.duplicate('plugin:demo-market/vercel-demo:deploy')
    const draft = skills.drafts().find((candidate) => candidate.id === draftId)
    expect(draft).toMatchObject({ skillId: 'perso:deploy', origin: 'duplicate', isNew: true })
    expect(changes).toBeGreaterThan(0)
  })
})
