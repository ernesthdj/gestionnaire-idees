import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { EditorService } from '../../../src/main/application/finals/EditorService'
import { editorArgs, isSafeToOpen } from '../../../src/main/domain/finals/editor'
import type { EditorSetting } from '../../../src/main/infrastructure/db/repositories/AppSettingsRepository'
import type {
  DeliverableFileRow,
  FinalActionRow
} from '../../../src/main/infrastructure/db/repositories/FinalRepository'
import { isProgram } from '../../../src/main/infrastructure/editor/EditorLauncher'
import { ProjectFiles } from '../../../src/main/infrastructure/finals/ProjectFiles'

const ACTION = 'a0000000-0000-4000-8000-000000000001'
const CODE = 'C:\\Users\\x\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe'

const row = (path: string): DeliverableFileRow => ({
  id: path,
  neuronId: ACTION,
  path,
  pathKey: path.toLowerCase(),
  beforeContent: null,
  afterContent: 'x',
  afterHash: 'h',
  updatedAt: '2026-10-06T10:00:00.000Z',
  revertedAt: null
})

describe('ouvrir un fichier du livrable dans un éditeur (spec 013 D4, FR-020)', () => {
  let root: string
  let project: string
  let stored: EditorSetting | null
  let picked: string | null
  let launch: Mock<(program: string, args: readonly string[]) => Promise<void>>
  let openPath: Mock<(path: string) => Promise<string>>
  let service: EditorService

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-editor-'))
    project = join(root, 'projet')
    mkdirSync(join(project, 'src'), { recursive: true })
    mkdirSync(join(root, 'profil'))
    for (const name of ['a.ts', 'tool.js']) writeFileSync(join(project, 'src', name), 'x')
    stored = null
    picked = null
    launch = vi.fn<(program: string, args: readonly string[]) => Promise<void>>(async () => undefined)
    openPath = vi.fn<(path: string) => Promise<string>>(async () => '')
    service = new EditorService({
      settings: { editor: () => stored, saveEditor: (value) => void (stored = value) },
      detect: () => [{ kind: 'vscode', name: 'VS Code', program: CODE }],
      chooseProgram: async () => picked,
      isProgram: (path) => path.endsWith('.exe'),
      launch,
      openPath,
      repository: {
        get: (id) => (id === ACTION ? ({ neuronId: ACTION, genesisId: 'g' } as FinalActionRow) : undefined),
        files: () => [row('src/a.ts'), row('src/tool.js'), row('src/gone.ts')]
      },
      projectDir: () => project,
      files: new ProjectFiles({ profileDir: join(root, 'profil') })
    })
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('should_launch_the_chosen_editor_with_the_verified_absolute_path_and_line', async () => {
    await service.choose('vscode')
    expect(service.view()).toEqual({
      current: { kind: 'vscode', program: CODE },
      detected: [{ kind: 'vscode', name: 'VS Code' }]
    })
    await service.open(ACTION, 'src/a.ts', 12)
    expect(launch).toHaveBeenCalledWith(CODE, ['-g', `${join(project, 'src', 'a.ts')}:12`])
    // Même un script s'ouvre dans l'éditeur réglé : il est lu, pas exécuté.
    await service.open(ACTION, 'src/tool.js')
    expect(launch).toHaveBeenLastCalledWith(CODE, ['-g', `${join(project, 'src', 'tool.js')}:1`])
    expect(openPath).not.toHaveBeenCalled()
  })

  it('should_open_only_safe_text_files_with_the_windows_application_when_no_editor_is_set', async () => {
    await service.open(ACTION, 'src/a.ts')
    expect(openPath).toHaveBeenCalledWith(join(project, 'src', 'a.ts'))
    await expect(service.open(ACTION, 'src/tool.js')).rejects.toMatchObject({ code: 'NO_EDITOR' })
    expect(openPath).toHaveBeenCalledTimes(1)
  })

  it('should_refuse_paths_outside_the_deliverable_and_missing_files', async () => {
    writeFileSync(join(project, '.env'), 'SECRET=1')
    await expect(service.open(ACTION, '.env')).rejects.toThrow(/ne fait pas partie du livrable/)
    await expect(service.open(ACTION, '../profil/x')).rejects.toThrow(/ne fait pas partie du livrable/)
    await expect(service.open(ACTION, 'src/gone.ts')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(launch).not.toHaveBeenCalled()
    expect(openPath).not.toHaveBeenCalled()
  })

  it('should_keep_the_setting_when_the_dialog_is_cancelled_and_refuse_a_non_program', async () => {
    await service.choose('vscode')
    picked = null
    expect((await service.choose('browse')).current?.kind).toBe('vscode')
    picked = 'C:\\outils\\editeur.cmd'
    await expect(service.choose('browse')).rejects.toMatchObject({ code: 'VALIDATION' })
    picked = 'C:\\outils\\editeur.exe'
    expect((await service.choose('browse')).current).toEqual({ kind: 'other', program: 'C:\\outils\\editeur.exe' })
    expect(service.clear().current).toBeNull()
  })

  it('should_refuse_an_editor_that_was_not_detected', async () => {
    await expect(service.choose('notepadpp')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('éditeur : arguments et liste blanche (purs)', () => {
  it('should_build_fixed_arguments_with_the_file_as_its_own_argument', () => {
    const file = 'C:\\p\\a & b.ts'
    expect(editorArgs('vscode', file, 3)).toEqual(['-g', 'C:\\p\\a & b.ts:3'])
    expect(editorArgs('notepadpp', file, 3)).toEqual(['-n3', file])
    expect(editorArgs('other', file, 3)).toEqual([file])
    expect(editorArgs('notepadpp', file, 0)).toEqual(['-n1', file])
  })

  it('should_never_hand_executable_types_to_the_windows_application', () => {
    for (const path of ['a.md', 'b.TS', 'c.tsx', 'd.json', 'e.css']) expect(isSafeToOpen(path)).toBe(true)
    for (const path of ['a.js', 'b.bat', 'c.CMD', 'd.ps1', 'e.vbs', 'f.hta', 'g.lnk', 'h.exe', 'i.wsf', 'Makefile']) {
      expect(isSafeToOpen(path)).toBe(false)
    }
  })

  it('should_accept_only_an_existing_absolute_exe_as_a_program', () => {
    expect(isProgram(process.execPath)).toBe(process.platform === 'win32')
    expect(isProgram('notepad.exe')).toBe(false)
    expect(isProgram('C:\\inexistant\\editeur.exe')).toBe(false)
  })
})
