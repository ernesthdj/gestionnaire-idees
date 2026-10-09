import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BrainstormScope } from '../../../src/main/application/brainstorms/BrainstormScope'
import { ExistingProjectService } from '../../../src/main/application/brainstorms/ExistingProjectService'
import { existingFolderProblem } from '../../../src/main/domain/brainstorms/paths'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { BrainstormRepository } from '../../../src/main/infrastructure/db/repositories/BrainstormRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { externalRefs } from '../../../src/main/infrastructure/hub/ExternalRefs'
import { buildVault } from '../../support/vault'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('projet en chantier (spec 024 US4)', () => {
  let dir: string
  let handle: DatabaseHandle
  let repository: BrainstormRepository
  let neurons: NeuronRepository
  let root: string
  let project: string
  let picked: string | undefined
  let attached: Map<string, string>

  const service = (): ExistingProjectService =>
    new ExistingProjectService({
      repository,
      pickFolder: async () => picked,
      rules: () => ({ dataDir: join(dir, 'profil'), projectsRoot: root, home: join(dir, 'home'), systemDirs: [] }),
      createGenesis: (title, content, brainstormId) => {
        const id = randomUUID()
        neurons.insertRoot({ id, title, content, nature: 'reflection', natureSource: null, brainstormId })
        return id
      },
      attach: (neuronId, folder) => attached.set(neuronId, folder),
      now: () => new Date('2026-10-10T10:00:00Z')
    })

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-existing-'))
    for (const sub of ['profil', 'home']) mkdirSync(join(dir, sub))
    handle = openDatabase({ file: join(dir, 'g.db'), key: '9'.repeat(64), migrationsFolder: MIGRATIONS })
    repository = new BrainstormRepository(handle.db)
    neurons = new NeuronRepository(handle.db, new BrainstormScope(() => repository.ensureLoose()))
    root = buildVault(join(dir, 'coffre'))
    project = join(dir, 'ailleurs', 'projet-groupe')
    mkdirSync(join(project, 'src'), { recursive: true })
    mkdirSync(join(project, '.git'))
    writeFileSync(join(project, '.git', 'HEAD'), 'ref: refs/heads/dev\n')
    writeFileSync(join(project, '.gitignore'), 'node_modules/\n')
    writeFileSync(join(project, 'src', 'app.ts'), 'export {}\n')
    picked = project
    attached = new Map()
  })
  afterEach(() => {
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should_preview_the_writes_without_touching_the_project', async () => {
    const before = readdirSync(project).sort()
    const preview = await service().pick()
    expect(preview).toMatchObject({
      suggestedName: 'projet-groupe',
      vault: 'none',
      isRepo: true,
      branch: 'dev',
      problem: null,
      writes: [
        '.brainstormer/brainstorm.json',
        '.brainstormer/sessions.json',
        '.gitignore (une ligne ajoutée : .brainstormer/)'
      ]
    })
    expect(readdirSync(project).sort()).toEqual(before)
    picked = undefined
    expect(await service().pick()).toBeNull()
  })

  it('should_adopt_the_folder_in_place_with_its_vault_ignored_by_git_and_an_external_reference', async () => {
    const existing = service()
    const preview = await existing.pick()
    const { id } = existing.adopt({
      pickId: preview?.pickId ?? '',
      name: 'Projet de groupe',
      description: 'Fictif',
      role: 'owner'
    })
    const row = repository.get(id)
    expect(row).toMatchObject({ location: 'external', origin: 'existing', gitRole: 'owner', folderPath: project })
    expect(readFileSync(join(project, '.gitignore'), 'utf8')).toBe('node_modules/\n.brainstormer/\n')
    const vault = JSON.parse(readFileSync(join(project, '.brainstormer', 'brainstorm.json'), 'utf8')) as {
      brainstormId: string
    }
    expect(vault.brainstormId).toBe(id)
    // Le dossier n'a pas bougé et ses fichiers sont intacts.
    expect(readFileSync(join(project, 'src', 'app.ts'), 'utf8')).toBe('export {}\n')
    expect([...attached.values()]).toEqual([project])
    expect(externalRefs(root)).toEqual([{ slug: row?.slug, name: 'Projet de groupe', path: project }])
    // Le même choix ne sert qu'une fois.
    expect(() => existing.adopt({ pickId: preview?.pickId ?? '', name: 'x', description: '', role: 'owner' })).toThrow(
      /expiré/
    )
  })

  it('should_recognize_a_moved_project_by_its_vault_and_relink_it', async () => {
    const existing = service()
    const preview = await existing.pick()
    const { id } = existing.adopt({ pickId: preview?.pickId ?? '', name: 'Groupe', description: '', role: 'owner' })
    const moved = join(dir, 'deplace', 'projet-groupe')
    mkdirSync(join(dir, 'deplace'))
    renameSync(project, moved)
    // Un dossier sans ce vault est refusé.
    const other = join(dir, 'autre')
    mkdirSync(other)
    picked = other
    await expect(existing.relink(id)).rejects.toMatchObject({ code: 'VAULT_MISMATCH' })
    picked = moved
    expect(await existing.relink(id)).toEqual({ ok: true })
    expect(repository.get(id)?.folderPath).toBe(moved)
    expect(externalRefs(root)[0]?.path).toBe(moved)
    // Rechoisir le dossier d'un brainstorm connu le rouvre, sans rien réécrire.
    const again = await existing.pick()
    expect(again).toMatchObject({ vault: 'known', writes: [] })
    expect(existing.adopt({ pickId: again?.pickId ?? '', name: 'x', description: '', role: 'owner' })).toEqual({ id })
  })

  it('should_refuse_a_damaged_vault_and_never_overwrite_it', async () => {
    mkdirSync(join(project, '.brainstormer'))
    writeFileSync(join(project, '.brainstormer', 'brainstorm.json'), '{ pas du json')
    const existing = service()
    const preview = await existing.pick()
    expect(preview?.problem).toMatch(/illisible/)
    expect(() => existing.adopt({ pickId: preview?.pickId ?? '', name: 'x', description: '', role: 'owner' })).toThrow(
      /illisible/
    )
    expect(readFileSync(join(project, '.brainstormer', 'brainstorm.json'), 'utf8')).toBe('{ pas du json')
    expect(repository.list()).toEqual([])
  })

  it('should_create_the_gitignore_when_the_project_has_none_and_keep_role_none_without_running_git', async () => {
    rmSync(join(project, '.git'), { recursive: true })
    rmSync(join(project, '.gitignore'))
    const existing = service()
    const preview = await existing.pick()
    expect(preview).toMatchObject({ isRepo: false, branch: null })
    expect(preview?.writes).toContain('.gitignore (créé)')
    const { id } = existing.adopt({ pickId: preview?.pickId ?? '', name: 'Sans dépôt', description: '', role: 'none' })
    expect(repository.get(id)?.gitRole).toBe('none')
    expect(readFileSync(join(project, '.gitignore'), 'utf8')).toBe('.brainstormer/\n')
    expect(existsSync(join(project, '.git'))).toBe(false)
  })

  it('should_refuse_the_app_folder_a_disk_root_system_folders_and_the_vault', () => {
    const rules = {
      dataDir: 'C:\\Users\\x\\AppData\\Roaming\\gestionnaire-idees',
      projectsRoot: 'C:\\coffre\\projects',
      home: 'C:\\Users\\y',
      systemDirs: ['C:\\Windows', 'C:\\Program Files']
    }
    expect(existingFolderProblem('C:\\', rules)).toMatch(/racine/)
    expect(existingFolderProblem('C:\\Users\\x\\AppData\\Roaming\\gestionnaire-idees\\workspace', rules)).toMatch(
      /données/
    )
    expect(existingFolderProblem('C:\\Users\\x\\AppData\\Roaming', rules)).toMatch(/données/)
    expect(existingFolderProblem('C:\\Users\\y', rules)).toMatch(/personnel/)
    expect(existingFolderProblem('C:\\Program Files\\outil', rules)).toMatch(/système/)
    expect(existingFolderProblem('C:\\coffre', rules)).toMatch(/contient ton coffre/)
    expect(existingFolderProblem('C:\\coffre\\projects\\alpha', rules)).toMatch(/rangé dans ton coffre/)
    expect(existingFolderProblem('D:\\travail\\projet', rules)).toBeNull()
    expect(existingFolderProblem('relatif\\projet', rules)).toMatch(/chemin complet/)
  })
})
