import { createHash } from 'node:crypto'

/**
 * Fichiers d'un brouillon de skill et différences avec la version installée (spec 020 T020) : fonctions pures. Un
 * brouillon décrit le `SKILL.md` (en-tête `name` + `description`, puis le corps) et ses annexes ; les fichiers du skill
 * installé qu'il ne mentionne pas restent tels quels à l'installation.
 */

export interface DraftFile {
  /** Relatif au dossier du skill, séparateur `/`. */
  readonly path: string
  readonly content: string
}

export type DiffStatus = 'ajout' | 'modifie' | 'inchange'

export interface FileDiff {
  readonly path: string
  readonly status: DiffStatus
  /** Contenu installé, `null` pour un ajout. */
  readonly before: string | null
  readonly after: string
}

/** Valeur d'en-tête entre guillemets doubles, échappée pour l'analyseur de `frontMatter.ts`. */
const quoted = (value: string): string =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`

/** Texte complet du `SKILL.md` d'un brouillon. */
export function skillMarkdown(name: string, description: string, content: string): string {
  const body = content.replace(/^\uFEFF/, '').replace(/^\s*\n/, '')
  return `---\nname: ${name}\ndescription: ${quoted(description.trim())}\n---\n\n${body.endsWith('\n') ? body : `${body}\n`}`
}

/** Fichiers écrits par l'installation d'un brouillon : `SKILL.md` puis les annexes, triées. */
export function draftFiles(draft: {
  readonly name: string
  readonly description: string
  readonly content: string
  readonly annexes: readonly DraftFile[]
}): DraftFile[] {
  return [
    { path: 'SKILL.md', content: skillMarkdown(draft.name, draft.description, draft.content) },
    ...[...draft.annexes].filter((file) => file.path !== 'SKILL.md').sort((a, b) => (a.path < b.path ? -1 : 1))
  ]
}

/** Différences fichier par fichier entre le brouillon et le skill installé (`installed` : chemin → contenu). */
export function diffFiles(files: readonly DraftFile[], installed: ReadonlyMap<string, string>): FileDiff[] {
  return files.map((file) => {
    const before = installed.get(file.path) ?? null
    const status: DiffStatus = before === null ? 'ajout' : before === file.content ? 'inchange' : 'modifie'
    return { path: file.path, status, before, after: file.content }
  })
}

/** Empreinte d'un ensemble de fichiers (chemins triés + contenus) : l'état d'un skill sur le disque. */
export function filesHash(files: ReadonlyMap<string, Buffer | string>): string {
  const hash = createHash('sha256')
  for (const path of [...files.keys()].sort()) {
    hash.update(path)
    hash.update('\0')
    hash.update(files.get(path) as Buffer | string)
    hash.update('\0')
  }
  return hash.digest('hex').slice(0, 32)
}
