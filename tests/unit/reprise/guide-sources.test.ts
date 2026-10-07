import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkSource, knownSources } from '../../../src/main/domain/reprise/guideSources'
import { readProjectText } from '../../../src/main/infrastructure/reprise/projectText'

const known = knownSources(
  ['src/App.Core/Invoice.cs', 'src/App.Web/Program.cs', 'README.md'],
  ['csproj:App.Core'],
  [
    { path: 'src/App.Core/Invoice.cs', name: 'Total', qualifiedName: 'App.Core.Invoice.Total' },
    { path: 'src/App.Web/Program.cs', name: 'Main', qualifiedName: 'Program.Main' }
  ]
)

describe('sources du guide (spec 017 FR-029)', () => {
  it('should_keep_files_folders_modules_and_symbols_that_exist_in_the_project', () => {
    expect(checkSource('src/App.Core/Invoice.cs', known)).toBe('src/App.Core/Invoice.cs')
    expect(checkSource('`./src\\App.Web\\Program.cs:12`', known)).toBe('src/App.Web/Program.cs')
    expect(checkSource('src/App.Core/Invoice.cs#L4-L9', known)).toBe('src/App.Core/Invoice.cs')
    expect(checkSource('src/App.Core/', known)).toBe('src/App.Core')
    expect(checkSource('csproj:App.Core', known)).toBe('csproj:App.Core')
    expect(checkSource('src/App.Core/Invoice.cs#Total', known)).toBe('src/App.Core/Invoice.cs#Total')
    expect(checkSource('Program.Main()', known)).toBe('Program.Main')
  })

  it('should_reject_invented_paths_symbols_or_escapes_when_checking', () => {
    for (const source of [
      'src/Invente.cs',
      'src/App.Core/Invoice.cs#Fantome',
      '../secret.txt',
      'C:/Users/x/projet/README.md',
      'Fantome',
      '  '
    ]) {
      expect(checkSource(source, known), source).toBeNull()
    }
  })
})

describe('lecture d’un fichier du projet repris', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-ptext-'))
    mkdirSync(join(root, 'projet'))
    writeFileSync(join(root, 'projet', 'README.md'), '# Démo')
    writeFileSync(join(root, 'dehors.txt'), 'secret')
    writeFileSync(join(root, 'projet', 'image.bin'), Buffer.from([0, 1, 2]))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('should_read_a_text_file_under_the_root_only_when_small_enough', () => {
    const project = join(root, 'projet')
    expect(readProjectText(project, 'README.md', 1024)).toBe('# Démo')
    expect(readProjectText(project, 'README.md', 2)).toBeNull()
    expect(readProjectText(project, '../dehors.txt', 1024)).toBeNull()
    expect(readProjectText(project, 'image.bin', 1024)).toBeNull()
    expect(readProjectText(project, 'absent.md', 1024)).toBeNull()
  })
})
