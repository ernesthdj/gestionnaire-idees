import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FolderService } from '../../../src/main/application/folders/FolderService'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { DocumentRepository } from '../../../src/main/infrastructure/db/repositories/DocumentRepository'
import { FolderRepository } from '../../../src/main/infrastructure/db/repositories/FolderRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { ProjectFiles } from '../../../src/main/infrastructure/finals/ProjectFiles'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

/**
 * Spec 028 lot 2 (code gardé, dossiers désactivés) : fichiers écrits en conversation, ajoutés à la main, retirés ou
 * masqués — jamais copiés ni effacés sur le disque, toujours sous le projet lié, annulables.
 */
describe('sources du dossier d’un nœud (spec 028 US2)', () => {
  let t: NeuronHarness
  let root: string
  let project: string
  let folders: FolderService
  let history: HistoryService
  let changed: string[]
  let node: string
  let lonely: string

  beforeEach(async () => {
    t = createNeuronHarness()
    root = realpathSync(mkdtempSync(join(tmpdir(), 'gi-folder-src-')))
    project = join(root, 'projet')
    mkdirSync(join(project, 'src'), { recursive: true })
    mkdirSync(join(root, 'profil'))
    writeFileSync(join(project, 'src', 'bilan.ts'), 'export const bilan = 1\n')
    writeFileSync(join(project, 'cours.md'), '# Cours\n')
    writeFileSync(join(project, '.env'), 'SECRET=faux\n')
    writeFileSync(join(root, 'dehors.md'), 'hors projet\n')
    node = (await t.neurons.create({ text: 'Bilan' })).id
    lonely = (await t.neurons.create({ text: 'Sans projet' })).id
    changed = []
    const repository = new FolderRepository(t.handle.db)
    folders = new FolderService({
      repository,
      documents: new DocumentRepository(t.handle.db),
      projectDirOf: (id) => (id === node ? project : null),
      files: new ProjectFiles({ profileDir: join(root, 'profil') }),
      exists: existsSync,
      changed: (id) => changed.push(id)
    })
    history = new HistoryService(new HistoryRepository(t.handle.db), folders.historyHandlers())
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  const paths = (): string[] => folders.badges(new Set([node]))[0]?.preview.map((file) => file.path) ?? []

  it('should_file_what_claude_writes_once_and_mark_it_new_again_on_each_write', () => {
    folders.record(node, 'src/bilan.ts')
    folders.record(node, 'SRC/Bilan.ts')
    const [badge] = folders.badges(new Set([node]))
    expect(badge).toMatchObject({ count: 1, unseen: true })
    expect(badge?.preview[0]).toMatchObject({ path: 'src/bilan.ts', source: 'conversation' })
    expect(changed).toEqual([node, node])
    expect(history.list().items[0]?.summary).toBe('Rangé dans le dossier : « bilan.ts »')
  })

  it('should_never_file_a_secret_a_path_outside_the_project_or_for_a_node_without_project', () => {
    folders.record(node, '.env')
    folders.record(node, '../dehors.md')
    folders.record(lonely, 'cours.md')
    expect(folders.badges(new Set([node, lonely]))).toEqual([])
  })

  it('should_add_a_project_file_by_hand_and_refuse_anything_else_with_a_clear_message', () => {
    expect(folders.add(node, 'cours.md').batchId).not.toBeNull()
    expect(folders.add(node, 'cours.md')).toEqual({ batchId: null })
    expect(paths()).toEqual(['cours.md'])
    for (const hostile of ['../dehors.md', 'C:/Windows/win.ini', '\\\\serveur\\partage\\x.md', '.env']) {
      expect(() => folders.add(node, hostile), hostile).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
    }
    expect(() => folders.add(node, 'absent.md')).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
    expect(() => folders.add(lonely, 'cours.md')).toThrow(expect.objectContaining({ code: 'NO_PROJECT' }))
  })

  it('should_refuse_a_symbolic_link_that_leads_outside_the_project', () => {
    try {
      symlinkSync(join(root, 'dehors.md'), join(project, 'lien.md'))
    } catch {
      return // Lien symbolique impossible sans droits sur ce poste : rien à vérifier.
    }
    expect(() => folders.add(node, 'lien.md')).toThrow(expect.objectContaining({ code: 'FOLDER_REFUSED' }))
  })

  it('should_remove_from_the_folder_without_touching_the_disk_and_bring_it_back_with_undo', () => {
    folders.add(node, 'cours.md')
    const { batchId } = folders.remove(node, 'cours.md')
    expect(paths()).toEqual([])
    expect(existsSync(join(project, 'cours.md'))).toBe(true)
    history.undo(batchId)
    expect(paths()).toEqual(['cours.md'])
  })

  it('should_hide_a_covered_file_and_show_it_again', () => {
    const covered = new Map([[node, ['src/bilan.ts', 'cours.md']]])
    const shown = (): string[] =>
      folders.badges(new Set([node]), covered)[0]?.preview.map((file) => `${file.path}:${file.source}`) ?? []
    expect(shown()).toEqual(['cours.md:covered', 'src/bilan.ts:covered'])
    folders.hide(node, 'src/bilan.ts')
    expect(shown()).toEqual(['cours.md:covered'])
    expect(history.list().items[0]?.summary).toBe('Masqué du dossier : « bilan.ts »')
    folders.unhide(node, 'src/bilan.ts')
    expect(shown()).toEqual(['cours.md:covered', 'src/bilan.ts:covered'])
  })

  it('should_read_only_a_filed_file_for_the_reader', () => {
    folders.record(node, 'src/bilan.ts')
    expect(folders.file(node, 'src/bilan.ts')).toMatchObject({
      path: 'src/bilan.ts',
      lines: ['export const bilan = 1', '']
    })
    expect(() => folders.file(node, 'cours.md')).toThrow(expect.objectContaining({ code: 'NOT_IN_FOLDER' }))
  })
})
