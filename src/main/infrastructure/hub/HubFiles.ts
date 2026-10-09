import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'

/**
 * Lecture des fichiers du coffre ProjectMaster (spec 024 R5) : `.hub/registry.json` et `.hub/sessions.json`, au format
 * du skill `/hub`, revalidés par Zod ; un fichier absent ou illisible donne une liste vide (jamais d'erreur, jamais
 * d'écriture ici). `root` est le dossier `projects/` du coffre (réglage de la spec 016).
 */

const MAX_BYTES = 2 * 1024 * 1024
const text = z.string().max(2000)

const RegistryProject = z.looseObject({
  slug: z.string().min(1).max(100).optional(),
  name: text.optional(),
  description: text.nullish(),
  type: text.nullish(),
  status: text.nullish(),
  branch: text.nullish(),
  last_session: text.nullish(),
  folder: z.string().max(200).nullish()
})
const Registry = z.looseObject({ projects: z.record(z.string().max(100), z.unknown()) })
const Sessions = z.looseObject({
  active_session: z.looseObject({ project_slug: z.string().max(100), opened_at: text }).nullish()
})

export interface RegistryProjectView {
  readonly slug: string
  readonly name: string
  readonly description: string
  readonly type: string | null
  readonly branch: string | null
  readonly lastSession: string | null
  /** Dossier du projet : `<root>/<folder>` (le slug sans `folder`). */
  readonly dir: string
}

function readJson(path: string): unknown {
  try {
    if (!existsSync(path) || statSync(path).size > MAX_BYTES) return undefined
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

/** Un dossier simple (pas de séparateur, pas de `..`) : `pm.bat` construit `projects/<folder>`. */
const SAFE_FOLDER = /^[A-Za-z0-9._ -]{1,100}$/

/** Projets du registre du coffre, hors archivés. */
export function registryProjects(root: string): RegistryProjectView[] {
  const registry = Registry.safeParse(readJson(join(dirname(root), '.hub', 'registry.json')))
  if (!registry.success) return []
  return Object.entries(registry.data.projects).flatMap(([key, value]): RegistryProjectView[] => {
    const project = RegistryProject.safeParse(value)
    if (!project.success || project.data.status === 'archived') return []
    const slug = project.data.slug ?? key
    const folder = project.data.folder ?? slug
    if (!SAFE_FOLDER.test(folder) || folder === '.' || folder === '..') return []
    return [
      {
        slug,
        name: project.data.name ?? slug,
        description: project.data.description ?? '',
        type: project.data.type ?? null,
        branch: project.data.branch ?? null,
        lastSession: project.data.last_session ?? null,
        dir: join(root, folder)
      }
    ]
  })
}

/** Session `/hub` ouverte dans le coffre ; `null` sans session ou fichier illisible. */
export function hubActiveSession(root: string): { readonly slug: string; readonly since: string } | null {
  const sessions = Sessions.safeParse(readJson(join(dirname(root), '.hub', 'sessions.json')))
  const active = sessions.success ? sessions.data.active_session : null
  return active === null || active === undefined ? null : { slug: active.project_slug, since: active.opened_at }
}

/** Contenu du JOURNAL d'un projet (`docs/JOURNAL.md`) ; vide s'il manque ou dépasse 5 Mo. */
export function projectJournal(dir: string): string {
  const path = join(dir, 'docs', 'JOURNAL.md')
  try {
    if (!existsSync(path) || statSync(path).size > 5 * 1024 * 1024) return ''
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}
