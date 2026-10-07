import type { ElementContentView } from '@shared/ipc/canvas'
import { covers } from './measured'

/** Extensions de documentation (spec 017 D18) ; tout autre fichier retenu compte comme du code, configuration comprise. */
export const DOC_EXTENSIONS = ['md', 'mdx', 'markdown', 'txt', 'rst', 'adoc'] as const

const DOC = new Set<string>(DOC_EXTENSIONS)

export const isDocFile = (path: string): boolean => {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  return dot > 0 && DOC.has(name.slice(dot + 1).toLowerCase())
}

/**
 * Contenu d'un élément (D18) : « code » dès qu'un de ses fichiers n'est pas de la documentation, « doc » sinon ;
 * `null` si ses chemins ne couvrent aucun fichier. `files` : chemins relatifs du projet, sans fichier sensible.
 */
export function contentOf(paths: readonly string[], files: readonly string[]): ElementContentView | null {
  let code = 0
  let doc = 0
  for (const file of files) {
    if (!covers(paths, file)) continue
    if (isDocFile(file)) doc += 1
    else code += 1
  }
  if (code + doc === 0) return null
  return { kind: code > 0 ? 'code' : 'doc', code, doc }
}
