import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SkillImportService, type SkillImportDeps } from '../../../src/main/application/skills/SkillImportService'
import { SkillService } from '../../../src/main/application/skills/SkillService'
import { SkillInventory } from '../../../src/main/application/skills/SkillInventory'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { SkillRepository } from '../../../src/main/infrastructure/db/repositories/SkillRepository'
import { SkillStore } from '../../../src/main/infrastructure/skills/SkillStore'
import type { CloneRequest, CloneResult } from '../../../src/main/application/reprise/CloneService'
import type { LibrarySkillView } from '../../../src/shared/ipc/skills'
import type { AuditVerdict } from '../../../src/shared/skills/audit'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const DEMO = resolve(import.meta.dirname, '../../fixtures/skills/demo-repo')
const URL = 'https://github.com/demo/skills'

describe('bibliothèque de skills importés depuis GitHub (spec 020 US4, D12)', () => {
  let root: string
  let library: string
  let handle: DatabaseHandle
  let skills: SkillService
  let imports: SkillImportService
  let clone: ReturnType<typeof vi.fn<(request: CloneRequest) => Promise<CloneResult>>>
  let audit: ReturnType<typeof vi.fn<SkillImportDeps['audit']>>
  /** Verdict de Claude simulé par nom de skill ; par défaut il est trompé et dit « sûr ». */
  let claudeSays: Record<string, AuditVerdict>
  let clones: number
  const events: string[] = []

  /** Clone simulé : copie du dépôt de démonstration dans le dossier demandé (le vrai clone est testé à part). */
  const copyDemo = async (request?: CloneRequest): Promise<CloneResult> => {
    clones += 1
    const dir = request?.target ?? join(library, 'ailleurs', String(clones))
    cpSync(DEMO, dir, { recursive: true })
    return { ok: true, dir, commit: String(clones).repeat(40), display: URL }
  }

  /** Copies du dépôt de démonstration dans la bibliothèque (`skills@<version>`). */
  const copies = (): string[] => {
    try {
      return readdirSync(join(library, 'github.com', 'demo'))
    } catch {
      return []
    }
  }

  const available = (): Map<string, LibrarySkillView> =>
    new Map((imports.library()[0]?.skills ?? []).map((skill) => [skill.name, skill]))

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'skills-import-'))
    library = join(root, 'skill-library')
    const home = join(root, 'home')
    mkdirSync(join(home, '.claude', 'skills'), { recursive: true })
    handle = openDatabase({ file: join(root, 'a.db'), key: '6'.repeat(64), migrationsFolder: MIGRATIONS })
    const repository = new SkillRepository(handle.db)
    const inventory = new SkillInventory({ home, projects: () => [] })
    skills = new SkillService({
      repository,
      store: new SkillStore(join(root, 'versions')),
      inventory,
      home,
      projects: () => [],
      onChanged: () => undefined
    })
    clones = 0
    claudeSays = {}
    clone = vi.fn(copyDemo)
    audit = vi.fn<SkillImportDeps['audit']>(async (input) => {
      const name = Object.keys(claudeSays).find((key) => input.skillMd.includes(`name: ${key}`))
      const verdict: AuditVerdict = name === undefined ? 'sur' : (claudeSays[name] ?? 'sur')
      return { ok: true, value: { data: { verdict, raisons: [], role: 'fictif' } } }
    })
    events.length = 0
    imports = new SkillImportService({
      repository,
      libraryRoot: library,
      clone,
      audit,
      writeDraft: (input, origin, options) => skills.writeDraft(input, origin, options),
      personalExists: () => false,
      emit: (event) => events.push(event.step)
    })
  })
  afterEach(() => {
    handle.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('should_keep_a_local_copy_and_list_skills_with_fixed_rule_verdicts_when_importing', async () => {
    imports.start(URL)
    await imports.idle()
    const [repo] = imports.library()
    // Copies écartées : `docs/ja-JP/skills/resume-reunion` (traduction) et `.kiro/skills/nettoyage` (autre outil).
    expect(repo).toMatchObject({ repo: URL, commit: '1'.repeat(40), truncated: false, skippedCopies: 2 })
    // La copie est gardée dans la bibliothèque ; le dossier temporaire est vide.
    expect(copies()).toEqual([expect.stringMatching(/^skills@[a-z0-9]{1,12}$/)])
    expect(existsSync(join(library, 'github.com', 'demo', copies()[0] ?? '', 'skills', 'piege', 'SKILL.md'))).toBe(true)
    const verdicts = Object.fromEntries([...available()].map(([name, skill]) => [name, skill.verdict]))
    expect(verdicts).toEqual({ nettoyage: 'a_revoir', piege: 'dangereux', 'resume-reunion': 'sur' })
    expect([...available().values()].map((skill) => skill.name)).toHaveLength(3)
    expect([...available().values()].every((skill) => !skill.auditedByClaude)).toBe(true)
    // Aucun audit de Claude à l'import : il a lieu au clic Installer.
    expect(audit).not.toHaveBeenCalled()
    expect(events).toEqual(expect.arrayContaining(['clone', 'reperage', 'audit', 'pret']))
    expect(imports.librarySkill(available().get('piege')?.candidateId as string).markdown).toContain('name: piege')
  })

  it('should_audit_with_claude_on_install_and_ask_again_when_the_verdict_gets_worse', async () => {
    claudeSays = { 'resume-reunion': 'a_revoir' }
    imports.start(URL)
    await imports.idle()
    const resume = available().get('resume-reunion')?.candidateId as string
    await expect(imports.install({ candidateId: resume, scripts: [], seen: 'sur' })).rejects.toMatchObject({
      code: 'VERDICT_CHANGED'
    })
    expect(available().get('resume-reunion')).toMatchObject({ verdict: 'a_revoir', auditedByClaude: true })
    expect(skills.drafts()).toEqual([])
    const { draftId, verdict } = await imports.install({ candidateId: resume, scripts: [], seen: 'a_revoir' })
    expect(verdict).toBe('a_revoir')
    expect(skills.drafts().map((draft) => [draft.id, draft.origin])).toEqual([[draftId, 'import']])
    // Même contenu : Claude n'audite pas deux fois.
    expect(audit).toHaveBeenCalledTimes(1)
  })

  it('should_lock_a_dangerous_skill_and_exclude_scripts_unless_allowed_one_by_one', async () => {
    imports.start(URL)
    await imports.idle()
    const piege = available().get('piege')?.candidateId as string
    // Claude simulé est trompé (« sûr ») : les règles fixes gardent « dangereux ».
    await expect(imports.install({ candidateId: piege, scripts: [], seen: 'dangereux' })).rejects.toMatchObject({
      code: 'DANGEROUS_LOCKED'
    })
    await expect(
      imports.install({ candidateId: piege, scripts: ['../../x.sh'], seen: 'dangereux', unlockDangerous: true })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    const { draftId } = await imports.install({
      candidateId: piege,
      scripts: [],
      seen: 'dangereux',
      unlockDangerous: true
    })
    // Le script n'a pas été autorisé : il n'est pas dans le brouillon.
    expect(skills.diff(draftId).files.map((file) => file.path)).toEqual(['SKILL.md'])
  })

  it('should_swap_folders_and_keep_claude_audits_of_unchanged_skills_when_updating', async () => {
    imports.start(URL)
    await imports.idle()
    const firstRepo = imports.library()[0]?.repoId
    await imports.install({
      candidateId: available().get('resume-reunion')?.candidateId as string,
      scripts: [],
      seen: 'sur'
    })
    await imports.install({
      candidateId: available().get('nettoyage')?.candidateId as string,
      scripts: [],
      seen: 'a_revoir'
    })
    // La nouvelle version du dépôt modifie « nettoyage ».
    clone.mockImplementationOnce(async (request) => {
      const result = await copyDemo(request)
      if (result.ok) appendFileSync(join(result.dir, 'skills', 'nettoyage', 'SKILL.md'), '\nNouvelle ligne.\n')
      return result
    })
    imports.start(URL)
    await imports.idle()
    const repos = imports.library()
    expect(repos).toHaveLength(1)
    expect(repos[0]?.repoId).not.toBe(firstRepo)
    expect(repos[0]?.commit).toBe('2'.repeat(40))
    expect(available().get('resume-reunion')?.auditedByClaude).toBe(true)
    expect(available().get('nettoyage')?.auditedByClaude).toBe(false)
    // L'ancienne version est supprimée : une seule copie reste.
    expect(copies()).toHaveLength(1)
  })

  it('should_keep_the_previous_copy_when_an_update_fails', async () => {
    imports.start(URL)
    await imports.idle()
    const before = imports.library()
    clone.mockResolvedValueOnce({ ok: false, code: 'NETWORK' })
    imports.start(URL)
    await imports.idle()
    expect(imports.library()).toEqual(before)
    expect(copies()).toHaveLength(1)
    expect(existsSync(join(library, 'github.com', 'demo', copies()[0] ?? '', 'skills', 'nettoyage', 'SKILL.md'))).toBe(
      true
    )
  })

  it('should_switch_to_the_new_copy_when_the_old_one_is_locked_and_sweep_it_at_startup', async () => {
    imports.start(URL)
    await imports.idle()
    const failures: { stage: string; code: string }[] = []
    const make = (removeDir?: (path: string) => void): SkillImportService =>
      new SkillImportService({
        repository: new SkillRepository(handle.db),
        libraryRoot: library,
        clone,
        audit,
        writeDraft: (input, origin, options) => skills.writeDraft(input, origin, options),
        personalExists: () => false,
        emit: (event) => events.push(event.step),
        logFailure: (fields) => failures.push(fields),
        ...(removeDir === undefined ? {} : { removeDir })
      })
    // L'ancienne copie est encore lue (Windows : EPERM) : la mise à jour réussit quand même, sans renommer de dossier.
    imports = make(() => {
      throw Object.assign(new Error('verrouillé'), { code: 'EPERM' })
    })
    imports.start(URL)
    await imports.idle()
    expect(imports.library()[0]?.commit).toBe('2'.repeat(40))
    expect(copies()).toHaveLength(2)
    expect(failures).toEqual([{ stage: 'nettoyage', code: 'EPERM' }])
    // Démarrage suivant : la copie que la base ne référence plus est supprimée, la courante est gardée.
    const before = imports.library()
    imports = make()
    imports.recover()
    expect(copies()).toHaveLength(1)
    expect(imports.library()).toEqual(before)
    expect(available().get('piege')).toBeDefined()
    expect(imports.librarySkill(available().get('piege')?.candidateId as string).markdown).toContain('name: piege')
  })

  it('should_refuse_a_trapped_address_without_cloning_and_clean_up_on_cancel', async () => {
    for (const url of ['ext::sh -c touch', '--upload-pack=x', 'file:///C:/x', 'ssh://host/x'])
      expect(() => imports.start(url)).toThrow(expect.objectContaining({ code: 'URL_REFUSED' }))
    expect(clone).not.toHaveBeenCalled()
    let release: () => void = () => undefined
    clone.mockImplementationOnce(async (request) => {
      const result = await copyDemo(request)
      await new Promise<void>((done) => (release = done))
      return result
    })
    imports.start(URL)
    await vi.waitFor(() => expect(clones).toBe(1))
    expect(() => imports.start(URL)).toThrow(expect.objectContaining({ code: 'IMPORT_RUNNING' }))
    const running = (imports as unknown as { running: { id: string } }).running.id
    imports.cancel(running)
    release()
    await imports.idle()
    expect(imports.library()).toEqual([])
    expect(copies()).toEqual([])
  })

  it('should_remove_a_repo_and_its_copy_without_touching_drafts', async () => {
    imports.start(URL)
    await imports.idle()
    await imports.install({
      candidateId: available().get('resume-reunion')?.candidateId as string,
      scripts: [],
      seen: 'sur'
    })
    imports.remove(imports.library()[0]?.repoId as string)
    expect(imports.library()).toEqual([])
    expect(existsSync(join(library, 'github.com'))).toBe(false)
    expect(skills.drafts().map((draft) => draft.name)).toEqual(['resume-reunion'])
  })
})
