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
import { hashOf } from '../../../src/main/infrastructure/documents/DocumentFiles'
import { PROJECT_FILE_MAX_BYTES, ProjectFiles } from '../../../src/main/infrastructure/finals/ProjectFiles'

describe('fichiers du projet lié écrits pendant une exécution (spec 013 R2, SC-002)', () => {
  let root: string
  let profile: string
  let project: string
  let outside: string
  let files: ProjectFiles

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-finals-'))
    profile = join(root, 'profil')
    project = join(root, 'projet')
    outside = join(root, 'ailleurs')
    for (const dir of [profile, project, outside]) mkdirSync(dir)
    files = new ProjectFiles({ profileDir: profile, now: () => new Date('2026-10-05T10:00:00.000Z') })
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  /** Jonction (Windows, sans droits d'administrateur) ou lien symbolique ; `false` si le système refuse. */
  const link = (target: string, path: string): boolean => {
    try {
      symlinkSync(target, path, 'junction')
      return true
    } catch {
      return false
    }
  }

  it('should_create_the_file_and_its_folders_inside_the_project_when_the_path_is_relative', () => {
    const hash = files.write(project, 'src/pages/Contact.tsx', 'export {}\n')
    expect(readFileSync(join(project, 'src', 'pages', 'Contact.tsx'), 'utf8')).toBe('export {}\n')
    expect(hash).toBe(hashOf('export {}\n'))
    expect(readdirSync(join(project, 'src', 'pages'))).toEqual(['Contact.tsx'])
  })

  it('should_read_back_the_content_and_return_null_when_the_file_is_absent', () => {
    expect(files.read(project, 'a.ts')).toBeNull()
    files.write(project, 'a.ts', 'x')
    expect(files.read(project, 'a.ts')).toEqual({ content: 'x', hash: hashOf('x') })
  })

  it.each(['../hors.txt', 'C:\\hors.txt', '.env', '.git/config', 'outil.exe'])(
    'should_write_nothing_when_the_path_is_hostile_%j',
    (path) => {
      expect(() => files.write(project, path, 'x')).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
      expect(readdirSync(outside)).toEqual([])
      expect(readdirSync(project)).toEqual([])
    }
  )

  it('should_refuse_to_write_through_a_junction_that_leads_outside_the_project', () => {
    if (!link(outside, join(project, 'docs'))) return
    expect(() => files.write(project, 'docs/a.md', 'x')).toThrow(expect.objectContaining({ code: 'FOLDER_REFUSED' }))
    expect(() => files.write(project, 'docs/sous/a.md', 'x')).toThrow(
      expect.objectContaining({ code: 'FOLDER_REFUSED' })
    )
    expect(readdirSync(outside)).toEqual([])
  })

  it('should_refuse_a_file_that_is_itself_a_link', () => {
    mkdirSync(join(outside, 'cible'))
    if (!link(join(outside, 'cible'), join(project, 'lien.md'))) return
    expect(() => files.write(project, 'lien.md', 'x')).toThrow(expect.objectContaining({ code: 'FOLDER_REFUSED' }))
  })

  it('should_refuse_too_large_or_binary_contents', () => {
    expect(() => files.write(project, 'gros.txt', 'a'.repeat(PROJECT_FILE_MAX_BYTES + 1))).toThrow(
      expect.objectContaining({ code: 'TOO_LARGE' })
    )
    writeFileSync(join(project, 'donnees.txt'), Buffer.from([0x61, 0x00, 0x62]))
    expect(() => files.read(project, 'donnees.txt')).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }))
  })

  it('should_refuse_a_folder_as_a_file_and_a_missing_project', () => {
    mkdirSync(join(project, 'src'))
    expect(() => files.write(project, 'src', 'x')).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
    expect(() => files.write(join(root, 'disparu'), 'a.ts', 'x')).toThrow(
      expect.objectContaining({ code: 'FOLDER_MISSING' })
    )
  })

  it('should_move_a_file_to_the_profile_trash_instead_of_deleting_it', () => {
    files.write(project, 'src/a.ts', 'x')
    files.trash(project, 'src/a.ts')
    expect(existsSync(join(project, 'src', 'a.ts'))).toBe(false)
    const trashed = readdirSync(join(profile, 'documents', '.corbeille'))
    expect(trashed).toEqual(['2026-10-05T10-00-00-000Z-src__a.ts'])
    files.trash(project, 'src/absent.ts')
  })
})
