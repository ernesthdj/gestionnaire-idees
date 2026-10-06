import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { extname, isAbsolute, join } from 'node:path'
import { AppError } from '../../domain/errors'
import type { EditorKind } from '../../domain/finals/editor'

/** Éditeur trouvé à son emplacement d'installation habituel. */
export interface DetectedEditor {
  readonly kind: Exclude<EditorKind, 'other'>
  readonly name: string
  readonly program: string
}

const CANDIDATES: readonly {
  readonly kind: DetectedEditor['kind']
  readonly name: string
  readonly paths: (env: NodeJS.ProcessEnv) => readonly (string | null)[]
}[] = [
  {
    kind: 'vscode',
    name: 'VS Code',
    paths: (env) => [
      env['LOCALAPPDATA'] === undefined ? null : join(env['LOCALAPPDATA'], 'Programs', 'Microsoft VS Code', 'Code.exe'),
      env['ProgramFiles'] === undefined ? null : join(env['ProgramFiles'], 'Microsoft VS Code', 'Code.exe')
    ]
  },
  {
    kind: 'notepadpp',
    name: 'Notepad++',
    paths: (env) => [
      env['ProgramFiles'] === undefined ? null : join(env['ProgramFiles'], 'Notepad++', 'notepad++.exe'),
      env['ProgramFiles(x86)'] === undefined ? null : join(env['ProgramFiles(x86)'], 'Notepad++', 'notepad++.exe')
    ]
  }
]

/** Éditeurs connus installés sur la machine (chemins fixes : rien n'est cherché dans le PATH). */
export function detectEditors(env: NodeJS.ProcessEnv = process.env): DetectedEditor[] {
  return CANDIDATES.flatMap((candidate) => {
    const program = candidate.paths(env).find((path) => path !== null && isProgram(path))
    return program === undefined || program === null ? [] : [{ kind: candidate.kind, name: candidate.name, program }]
  })
}

/** Un programme lançable sans interpréteur : chemin absolu d'un `.exe` existant (jamais `.cmd`, `.bat`, `.ps1`). */
export function isProgram(path: string): boolean {
  if (!isAbsolute(path) || extname(path).toLowerCase() !== '.exe' || !existsSync(path)) return false
  return statSync(path).isFile()
}

/** Lance l'éditeur détaché, sans shell, avec des arguments déjà construits ; résout au démarrage du processus. */
export function launchEditor(program: string, args: readonly string[]): Promise<void> {
  if (!isProgram(program)) {
    return Promise.reject(
      new AppError('NO_EDITOR', 'L’éditeur réglé est introuvable : choisis-le de nouveau dans Réglages › Éditeur.')
    )
  }
  return new Promise((resolve, reject) => {
    const child = spawn(program, [...args], { shell: false, detached: true, stdio: 'ignore', windowsHide: false })
    child.once('error', () => reject(new AppError('EDITOR_FAILED', 'L’éditeur n’a pas pu être lancé.')))
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}
