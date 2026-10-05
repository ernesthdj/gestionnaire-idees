import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DOCUMENT_MAX_BYTES, DocumentFiles, hashOf } from '../../../src/main/infrastructure/documents/DocumentFiles'

describe('fichiers des documents (spec 012 FR-002, FR-008, FR-010)', () => {
  let root: string
  let profile: string
  let project: string
  let files: DocumentFiles

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-docs-'))
    profile = join(root, 'profil')
    project = join(root, 'projet')
    mkdirSync(profile)
    mkdirSync(project)
    files = new DocumentFiles({ profileDir: profile, now: () => new Date('2026-10-05T10:00:00.000Z') })
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('should_write_in_docs_brainstormer_of_the_linked_project_and_create_the_folder', () => {
    const dir = files.folder({ kind: 'project', projectDir: project })
    const hash = files.write(dir, 'budget.md', '# Budget\n')
    expect(readFileSync(join(project, 'docs', 'brainstormer', 'budget.md'), 'utf8')).toBe('# Budget\n')
    expect(hash).toBe(hashOf('# Budget\n'))
  })

  it('should_write_in_the_documents_folder_of_the_profile_without_a_project', () => {
    const dir = files.folder({ kind: 'profile' })
    files.write(dir, 'note.md', 'x')
    expect(existsSync(join(profile, 'documents', 'note.md'))).toBe(true)
  })

  it('should_refuse_a_docs_folder_that_links_outside_the_project', () => {
    const outside = join(root, 'ailleurs')
    mkdirSync(outside)
    mkdirSync(join(project, 'docs'))
    try {
      symlinkSync(outside, join(project, 'docs', 'brainstormer'), 'junction')
    } catch {
      return // lien impossible sur cette machine : le cas ne peut pas se produire
    }
    expect(() => files.folder({ kind: 'project', projectDir: project })).toThrow(
      expect.objectContaining({ code: 'FOLDER_REFUSED' })
    )
  })

  it.each(['../evil.md', 'sous/x.md', 'C:\\x.md', 'x.txt', '.md', 'X.md'])('should_refuse_the_file_name_%j', (name) => {
    const dir = files.folder({ kind: 'profile' })
    expect(() => files.write(dir, name, 'x')).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
  })

  it('should_refuse_a_document_over_the_size_limit', () => {
    const dir = files.folder({ kind: 'profile' })
    expect(() => files.write(dir, 'gros.md', 'é'.repeat(DOCUMENT_MAX_BYTES))).toThrow(
      expect.objectContaining({ code: 'TOO_LARGE' })
    )
    expect(existsSync(join(dir, 'gros.md'))).toBe(false)
  })

  it('should_replace_the_file_atomically_and_leave_no_temporary_file', () => {
    const dir = files.folder({ kind: 'profile' })
    files.write(dir, 'a.md', 'v1')
    files.write(dir, 'a.md', 'v2')
    expect(readFileSync(join(dir, 'a.md'), 'utf8')).toBe('v2')
    expect(readdirSync(dir)).toEqual(['a.md'])
  })

  it('should_read_the_content_with_its_hash_or_report_a_missing_file', () => {
    const dir = files.folder({ kind: 'profile' })
    files.write(dir, 'a.md', 'contenu')
    writeFileSync(join(dir, 'a.md'), 'modifié dans Obsidian')
    expect(files.read(dir, 'a.md')).toEqual({ content: 'modifié dans Obsidian', hash: hashOf('modifié dans Obsidian') })
    expect(files.read(dir, 'absent.md')).toBeNull()
  })

  it('should_list_the_names_already_taken_in_lowercase', () => {
    const dir = files.folder({ kind: 'profile' })
    writeFileSync(join(dir, 'Budget.md'), 'x')
    expect(files.takenNames(dir)).toEqual(new Set(['budget.md']))
  })

  it('should_move_a_file_to_the_profile_trash_instead_of_deleting_it', () => {
    const dir = files.folder({ kind: 'project', projectDir: project })
    files.write(dir, 'budget.md', 'à garder')
    files.trash(dir, 'budget.md')
    expect(existsSync(join(dir, 'budget.md'))).toBe(false)
    const trash = join(profile, 'documents', '.corbeille')
    const [kept] = readdirSync(trash)
    expect(kept).toMatch(/budget\.md$/)
    expect(readFileSync(join(trash, kept ?? ''), 'utf8')).toBe('à garder')
    expect(() => files.trash(dir, 'absent.md')).not.toThrow()
  })
})
