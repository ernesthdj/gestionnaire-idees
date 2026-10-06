import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DeliverableReader } from '../../../src/main/application/finals/DeliverableReader'
import { hashOf } from '../../../src/main/infrastructure/documents/DocumentFiles'
import type {
  DeliverableFileRow,
  FinalActionRow
} from '../../../src/main/infrastructure/db/repositories/FinalRepository'
import { PROJECT_FILE_MAX_BYTES, ProjectFiles } from '../../../src/main/infrastructure/finals/ProjectFiles'
import { languageOf } from '../../../src/shared/files/language'

const ACTION = 'a0000000-0000-4000-8000-000000000001'

function row(path: string, before: string | null, after: string): DeliverableFileRow {
  return {
    id: path,
    neuronId: ACTION,
    path,
    pathKey: path.toLowerCase(),
    beforeContent: before,
    afterContent: after,
    afterHash: hashOf(after),
    updatedAt: '2026-10-06T10:00:00.000Z',
    revertedAt: null
  }
}

describe('visionneuse du livrable (spec 013 D4, FR-019)', () => {
  let root: string
  let project: string
  let linked: string | null
  let rows: DeliverableFileRow[]
  let reader: DeliverableReader

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-viewer-'))
    project = join(root, 'projet')
    mkdirSync(join(project, 'src'), { recursive: true })
    mkdirSync(join(root, 'profil'))
    linked = project
    rows = []
    reader = new DeliverableReader({
      repository: {
        get: (id) => (id === ACTION ? ({ neuronId: ACTION, genesisId: 'g' } as FinalActionRow) : undefined),
        files: () => rows
      },
      projectDir: () => linked,
      files: new ProjectFiles({ profileDir: join(root, 'profil') })
    })
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('should_return_before_after_and_current_content_when_the_file_is_unchanged_on_disk', () => {
    writeFileSync(join(project, 'src', 'a.ts'), 'export const a = 2\n')
    rows.push(row('src/a.ts', 'export const a = 1\n', 'export const a = 2\n'))
    expect(reader.file(ACTION, 'src/a.ts')).toEqual({
      path: 'src/a.ts',
      status: 'modifie',
      language: 'typescript',
      before: 'export const a = 1\n',
      after: 'export const a = 2\n',
      current: 'export const a = 2\n',
      missing: false,
      tooBig: false,
      binary: false,
      changedSince: false
    })
  })

  it('should_flag_a_file_changed_by_hand_since_claude_wrote_it', () => {
    writeFileSync(join(project, 'src', 'b.ts'), 'retouché\n')
    rows.push(row('src/b.ts', null, 'écrit par Claude\n'))
    const view = reader.file(ACTION, 'SRC/B.TS')
    expect(view.status).toBe('cree')
    expect(view.current).toBe('retouché\n')
    expect(view.changedSince).toBe(true)
  })

  it('should_report_missing_too_big_and_binary_files_without_their_content', () => {
    rows.push(row('src/absent.ts', null, 'x'), row('src/gros.txt', null, 'x'), row('src/image.txt', null, 'x'))
    writeFileSync(join(project, 'src', 'gros.txt'), 'a'.repeat(PROJECT_FILE_MAX_BYTES + 1))
    writeFileSync(join(project, 'src', 'image.txt'), Buffer.from([0x89, 0x00, 0x50]))
    expect(reader.file(ACTION, 'src/absent.ts')).toMatchObject({ current: null, missing: true })
    expect(reader.file(ACTION, 'src/gros.txt')).toMatchObject({ current: null, tooBig: true, changedSince: false })
    expect(reader.file(ACTION, 'src/image.txt')).toMatchObject({ current: null, binary: true })
  })

  it('should_refuse_a_path_that_is_not_in_the_deliverable', () => {
    writeFileSync(join(project, '.env'), 'SECRET=1')
    rows.push(row('src/a.ts', null, 'x'))
    expect(() => reader.file(ACTION, '.env')).toThrow(/ne fait pas partie du livrable/)
    expect(() => reader.file(ACTION, '../profil/x')).toThrow(/ne fait pas partie du livrable/)
    expect(() => reader.file('a0000000-0000-4000-8000-000000000009', 'src/a.ts')).toThrow(/introuvable/)
  })

  it('should_treat_every_file_as_missing_when_the_genesis_has_no_linked_folder', () => {
    linked = null
    rows.push(row('src/a.ts', null, 'x'))
    expect(reader.file(ACTION, 'src/a.ts')).toMatchObject({ current: null, missing: true })
  })
})

describe('langage d’un fichier pour la coloration', () => {
  it('should_map_known_extensions_and_fall_back_to_plain_text', () => {
    expect(languageOf('src/App.tsx')).toBe('typescript')
    expect(languageOf('Program.CS')).toBe('csharp')
    expect(languageOf('docs/README.md')).toBe('markdown')
    expect(languageOf('Makefile')).toBeNull()
    expect(languageOf('.gitignore')).toBeNull()
    expect(languageOf('notes.inconnu')).toBeNull()
  })
})
