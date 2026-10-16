import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ToolFileReader } from '../../../src/main/application/conversation/ToolFileReader'
import { ProjectFiles } from '../../../src/main/infrastructure/finals/ProjectFiles'

const N1 = '00000000-0000-4000-8000-0000000000d1'
const PATCH = JSON.stringify({
  hunks: [{ oldStart: 1, newStart: 1, lines: ['-a', '+b'] }],
  created: false,
  truncated: false
})

describe('fenêtre d’une pastille de fichier (spec 014 D9)', () => {
  let root: string
  let project: string
  let stored: Map<string, { path: string | null; patch: string | null }>

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-toolfile-'))
    project = join(root, 'projet')
    mkdirSync(join(project, 'src'), { recursive: true })
    writeFileSync(join(project, 'src', 'a.ts'), 'b\n')
    writeFileSync(join(project, 'notes.md'), '# Titre\n')
    writeFileSync(join(project, 'image.bin'), Buffer.from([1, 0, 2]))
    writeFileSync(join(project, 'donnees.txt'), Buffer.from([1, 0, 2]))
    writeFileSync(join(project, '.env'), 'SECRET=1\n')
    writeFileSync(join(root, 'secret.txt'), 'hors du projet\n')
    stored = new Map([
      ['m1', { path: join(project, 'src', 'a.ts'), patch: PATCH }],
      ['m2', { path: join(project, 'notes.md'), patch: null }],
      ['m3', { path: join(root, 'secret.txt'), patch: null }],
      ['m4', { path: join(project, 'disparu.ts'), patch: PATCH }],
      ['m5', { path: join(project, 'image.bin'), patch: null }],
      ['m6', { path: null, patch: null }],
      ['m7', { path: join(project, '.env'), patch: null }],
      ['m8', { path: join(project, 'donnees.txt'), patch: null }]
    ])
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const reader = (): ToolFileReader =>
    new ToolFileReader({
      message: (neuronId, messageId) => (neuronId === N1 ? stored.get(messageId) : undefined),
      roots: () => [project],
      files: new ProjectFiles({ profileDir: join(root, 'profil') })
    })

  it('should_show_the_change_and_the_current_file_when_it_is_in_the_conversation_folder', () => {
    expect(reader().read(N1, 'm1')).toEqual({
      path: 'src/a.ts',
      language: 'typescript',
      change: { hunks: [{ oldStart: 1, newStart: 1, lines: ['-a', '+b'] }], created: false, truncated: false },
      current: 'b\n',
      missing: false,
      outside: false,
      refused: false,
      tooBig: false,
      binary: false
    })
    expect(reader().read(N1, 'm2')).toMatchObject({ path: 'notes.md', change: null, current: '# Titre\n' })
  })

  it('should_never_show_a_file_outside_the_conversation_folders', () => {
    expect(reader().read(N1, 'm3')).toMatchObject({ path: 'secret.txt', outside: true, current: null })
  })

  it('should_say_when_the_file_is_gone_or_not_text', () => {
    expect(reader().read(N1, 'm4')).toMatchObject({ missing: true, current: null, change: { created: false } })
    expect(reader().read(N1, 'm8')).toMatchObject({ binary: true, current: null })
  })

  it('should_never_read_a_sensitive_or_known_binary_file', () => {
    expect(reader().read(N1, 'm7')).toMatchObject({ path: '.env', refused: true, current: null })
    expect(reader().read(N1, 'm5')).toMatchObject({ path: 'image.bin', refused: true, current: null })
  })

  it('should_refuse_a_message_of_another_conversation_or_without_file', () => {
    expect(() => reader().read('00000000-0000-4000-8000-0000000000d2', 'm1')).toThrow(/introuvable/)
    expect(() => reader().read(N1, 'm6')).toThrow(/introuvable/)
  })
})
