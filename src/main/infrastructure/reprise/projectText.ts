import { readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'

/**
 * Texte d'un fichier d'un projet repris (`path` relatif, `/`), en lecture seule : chemin réel strictement sous la racine
 * réelle (un lien qui mène dehors est refusé), fichier ordinaire, `maxBytes` au plus, pas de binaire. `null` sinon.
 */
export function readProjectText(root: string, path: string, maxBytes: number): string | null {
  try {
    const real = realpathSync(root)
    const target = realpathSync(join(real, ...path.split('/')))
    const inside = relative(real, target)
    if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) return null
    const stat = statSync(target)
    if (!stat.isFile() || stat.size > maxBytes) return null
    const text = readFileSync(target, 'utf8')
    return text.includes('\u0000') ? null : text
  } catch {
    return null
  }
}
