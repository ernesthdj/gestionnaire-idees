import { extname } from 'node:path'

/**
 * Ouvrir un fichier du livrable dans un éditeur (spec 013 D4, R10, FR-020). Pur : arguments d'un éditeur connu et
 * liste blanche des extensions ouvrables par l'application associée de Windows.
 */

export const EDITOR_KINDS = ['vscode', 'notepadpp', 'other'] as const
export type EditorKind = (typeof EDITOR_KINDS)[number]

/** Arguments fixes par éditeur : le chemin (absolu, vérifié) est toujours un argument à lui seul, jamais concaténé
 * dans une ligne de commande — l'éditeur est lancé sans interpréteur. */
export function editorArgs(kind: EditorKind, file: string, line: number): string[] {
  const at = Number.isInteger(line) && line >= 1 ? line : 1
  switch (kind) {
    case 'vscode':
      return ['-g', `${file}:${at}`]
    case 'notepadpp':
      return [`-n${at}`, file]
    case 'other':
      return [file]
  }
}

/**
 * Extensions qu'on peut confier à l'application associée sans risque d'exécution. Exclues : tout ce que Windows
 * exécute ou interprète (`.js` et `.vbs` par Windows Script Host, `.bat`, `.cmd`, `.ps1`, `.hta`, `.lnk`, `.exe`…).
 */
const SAFE_TO_OPEN = new Set([
  '.md',
  '.txt',
  '.json',
  '.css',
  '.scss',
  '.html',
  '.htm',
  '.ts',
  '.tsx',
  '.jsx',
  '.mts',
  '.cts',
  '.php',
  '.cs',
  '.cpp',
  '.c',
  '.h',
  '.hpp',
  '.sql',
  '.yml',
  '.yaml',
  '.xml',
  '.csv',
  '.log',
  '.ini',
  '.toml'
])

export function isSafeToOpen(path: string): boolean {
  return SAFE_TO_OPEN.has(extname(path).toLowerCase())
}
