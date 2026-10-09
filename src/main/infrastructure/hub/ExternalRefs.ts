import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { AppError } from '../../domain/errors'

/**
 * Références externes du coffre (spec 024 R6) : `.hub/external.json`, que `pm.bat` ignore, tant que le lanceur ne lit
 * pas `path` dans le registre (modification proposée à mentalyas, tâche T001). Écriture atomique, jamais sur un JSON
 * illisible ; entrées inconnues gardées.
 */

const Entry = z.looseObject({ slug: z.string().min(1).max(100), name: z.string().max(200), path: z.string().max(1000) })
const File = z.looseObject({ version: z.literal(1), projects: z.array(z.unknown()) })

export interface ExternalRef {
  readonly slug: string
  readonly name: string
  readonly path: string
}

const fileOf = (root: string): string => join(dirname(root), '.hub', 'external.json')

/** Références lisibles ; liste vide sans coffre, sans fichier ou sur un fichier illisible. */
export function externalRefs(root: string): ExternalRef[] {
  const path = fileOf(root)
  try {
    if (!existsSync(path) || statSync(path).size > 1024 * 1024) return []
    const parsed = File.safeParse(JSON.parse(readFileSync(path, 'utf8')))
    if (!parsed.success) return []
    return parsed.data.projects.flatMap((value) => {
      const entry = Entry.safeParse(value)
      return entry.success ? [{ slug: entry.data.slug, name: entry.data.name, path: entry.data.path }] : []
    })
  } catch {
    return []
  }
}

/** Ajoute ou met à jour la référence d'un projet (par son slug). Sans dossier `.hub` : rien n'est écrit. */
export function saveExternalRef(root: string, ref: ExternalRef): void {
  const path = fileOf(root)
  if (!existsSync(dirname(path))) return
  let current: z.infer<typeof File> = { version: 1, projects: [] }
  if (existsSync(path)) {
    const parsed = (() => {
      try {
        return File.safeParse(JSON.parse(readFileSync(path, 'utf8')))
      } catch {
        return null
      }
    })()
    if (parsed === null || !parsed.success) {
      throw new AppError('VALIDATION', 'Le fichier .hub/external.json est illisible : rien n’a été écrit.')
    }
    current = parsed.data
  }
  const others = current.projects.filter((value) => Entry.safeParse(value).data?.slug !== ref.slug)
  const next = { ...current, projects: [...others, ref] }
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  renameSync(temporary, path)
}
