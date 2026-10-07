import { createHash } from 'node:crypto'
import { lstatSync, readdirSync, readFileSync, realpathSync, watch, type FSWatcher } from 'node:fs'
import { join } from 'node:path'
import type { SkillDetailView, SkillFileView, SkillsView, SkillView } from '@shared/ipc/skills'
import { parseSkillMarkdown } from '@shared/skills/frontMatter'
import {
  persoId,
  pluginId,
  projetId,
  SKILL_FILES_MAX,
  SKILL_MD_MAX_BYTES,
  type SkillFamily
} from '@shared/skills/model'
import { AppError } from '../../domain/errors'
import { writtenLinks } from '../../domain/skills/links'
import { compareVersions, isExecutablePath, isInside, isSkillName } from '../../domain/skills/paths'

/** Projet lié à un genesis de la carte (dossier choisi par mentalyas, specs 008, 016, 017). */
export interface LinkedProject {
  readonly genesisId: string
  readonly title: string
  readonly dir: string
}

export interface SkillInventoryOptions {
  /** Dossier personnel (`~`) : `~/.claude/skills` et `~/.claude/plugins/cache`. */
  readonly home: string
  readonly projects: () => readonly LinkedProject[]
  /** Toile changée (surveillance des dossiers personnels et de projet). */
  readonly onChanged?: (scannedAt: number) => void
  readonly now?: () => number
}

interface Entry {
  readonly view: SkillView
  /** Dossier réel du skill (jamais transmis au renderer). */
  readonly dir: string
  readonly text: string
}

/** Profondeur maximale de recherche des dossiers `skills/` dans la version d'un plugin (research R3). */
const PLUGIN_DEPTH = 6
/** Regroupement des changements de fichiers avant un nouvel inventaire. */
const WATCH_DEBOUNCE_MS = 1000

const real = (path: string): string | null => {
  try {
    return realpathSync.native(path)
  } catch {
    return null
  }
}

const isDir = (path: string): boolean => {
  try {
    return lstatSync(path).isDirectory()
  } catch {
    return false
  }
}

const listDirs = (path: string): string[] => {
  try {
    return readdirSync(path)
      .filter((name) => isDir(join(path, name)))
      .sort()
  } catch {
    return []
  }
}

/**
 * Inventaire des skills de Claude Code (spec 020 US1, research R1–R3) : personnels, de projet (genesis liés) et de
 * plugins (dernière version de chaque plugin). Lecture seule, jamais de lien symbolique suivi hors de sa racine,
 * `SKILL.md` borné à 200 Ko, fichiers annexes seulement listés. Résultat en cache jusqu'au prochain changement
 * surveillé ; les plugins sont relus à chaque ouverture de la page (`refresh`).
 */
export class SkillInventory {
  private cache: { readonly view: SkillsView; readonly entries: ReadonlyMap<string, Entry> } | null = null
  private watchers: FSWatcher[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly options: SkillInventoryOptions) {}

  /** Toile courante (inventaire fait au premier appel ou après un changement). */
  list(): SkillsView {
    return this.scan().view
  }

  /** Nouvel inventaire complet (ouverture de la page : les plugins ne sont pas surveillés). */
  refresh(): SkillsView {
    this.cache = null
    return this.list()
  }

  /** Détail d'un skill : son `SKILL.md` et la liste de ses fichiers, relus sur le disque. */
  get(skillId: string): SkillDetailView {
    const entry = this.scan().entries.get(skillId)
    if (entry === undefined) throw new AppError('NOT_FOUND', 'Skill introuvable')
    const files = listFiles(entry.dir)
    return { skill: entry.view, markdown: entry.text, files: files.files, filesTruncated: files.truncated }
  }

  /** Surveille les dossiers de skills personnels et de projet ; un changement relance l'inventaire (regroupé 1 s). */
  watch(): void {
    this.unwatch()
    const roots = [join(this.options.home, '.claude', 'skills'), ...this.projectRoots().map((root) => root.dir)]
    for (const root of roots) {
      if (!isDir(root)) continue
      try {
        this.watchers.push(watch(root, { recursive: true }, () => this.changed()))
      } catch {
        // Dossier disparu ou non surveillable : l'inventaire reste disponible à la demande.
      }
    }
  }

  unwatch(): void {
    for (const watcher of this.watchers) watcher.close()
    this.watchers = []
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
  }

  private changed(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.cache = null
      const view = this.list()
      this.options.onChanged?.(view.scannedAt)
    }, WATCH_DEBOUNCE_MS)
  }

  private projectRoots(): { readonly project: LinkedProject; readonly dir: string }[] {
    return this.options.projects().map((project) => ({ project, dir: join(project.dir, '.claude', 'skills') }))
  }

  private scan(): { readonly view: SkillsView; readonly entries: ReadonlyMap<string, Entry> } {
    if (this.cache !== null) return this.cache
    const entries: Entry[] = [
      ...this.family('perso', join(this.options.home, '.claude', 'skills'), (name) => persoId(name), 'personnel'),
      ...this.projectRoots().flatMap(({ project, dir }) =>
        this.family('projet', dir, (name) => projetId(project.genesisId, name), `projet ${project.title}`)
      ),
      ...this.plugins()
    ]
    const byName = new Map<string, string[]>()
    for (const entry of entries) byName.set(entry.view.name, [...(byName.get(entry.view.name) ?? []), entry.view.id])
    const withNames = entries.map((entry) => ({
      ...entry,
      view: { ...entry.view, sameNameAs: (byName.get(entry.view.name) ?? []).filter((id) => id !== entry.view.id) }
    }))
    const links = writtenLinks(
      withNames.filter((entry) => !entry.view.damaged).map((entry) => ({ ...entry.view, text: entry.text }))
    )
    const view: SkillsView = {
      skills: withNames.map((entry) => entry.view),
      links,
      scannedAt: (this.options.now ?? Date.now)()
    }
    this.cache = { view, entries: new Map(withNames.map((entry) => [entry.view.id, entry])) }
    return this.cache
  }

  /** Skills d'une racine (`<racine>/<nom>/SKILL.md`), dossiers réels restés dans la racine. */
  private family(family: SkillFamily, root: string, idOf: (name: string) => string, origin: string): Entry[] {
    const realRoot = real(root)
    if (realRoot === null) return []
    const entries: Entry[] = []
    for (const name of listDirs(realRoot)) {
      const entry = readSkill(family, realRoot, join(realRoot, name), name, idOf(name), origin)
      if (entry !== null) entries.push(entry)
    }
    return entries
  }

  /** Skills de plugins : pour chaque `<marketplace>/<plugin>`, la version la plus élevée seulement. */
  private plugins(): Entry[] {
    const cacheRoot = real(join(this.options.home, '.claude', 'plugins', 'cache'))
    if (cacheRoot === null) return []
    const entries: Entry[] = []
    for (const market of listDirs(cacheRoot)) {
      for (const plugin of listDirs(join(cacheRoot, market))) {
        const versions = listDirs(join(cacheRoot, market, plugin)).sort(compareVersions)
        const version = versions.at(-1)
        if (version === undefined) continue
        const versionRoot = join(cacheRoot, market, plugin, version)
        for (const skillsDir of findSkillsDirs(versionRoot, PLUGIN_DEPTH)) {
          for (const name of listDirs(skillsDir)) {
            const entry = readSkill(
              'plugin',
              versionRoot,
              join(skillsDir, name),
              name,
              pluginId(market, plugin, name),
              `plugin ${plugin} ${version}`
            )
            if (entry !== null && !entries.some((known) => known.view.id === entry.view.id)) entries.push(entry)
          }
        }
      }
    }
    return entries
  }
}

/** Dossiers nommés `skills` sous `root`, sans suivre de lien, jusqu'à `depth` niveaux. */
function findSkillsDirs(root: string, depth: number): string[] {
  const found: string[] = []
  const pending: { readonly path: string; readonly level: number }[] = [{ path: root, level: 0 }]
  while (pending.length > 0) {
    const { path, level } = pending.pop() as { path: string; level: number }
    for (const name of listDirs(path)) {
      if (name === 'node_modules' || name === '.git') continue
      const child = join(path, name)
      if (name === 'skills') found.push(child)
      else if (level < depth) pending.push({ path: child, level: level + 1 })
    }
  }
  return found.sort()
}

function readSkill(
  family: SkillFamily,
  root: string,
  dir: string,
  name: string,
  id: string,
  origin: string
): Entry | null {
  const file = join(dir, 'SKILL.md')
  const realFile = real(file)
  // Lien symbolique (fichier ou dossier) qui sort de la racine : ignoré.
  if (realFile === null || !isInside(realFile, root)) return null
  let size: number
  let modifiedAt: number
  try {
    const stat = lstatSync(realFile)
    if (!stat.isFile()) return null
    size = stat.size
    modifiedAt = stat.mtimeMs
  } catch {
    return null
  }
  const tooLarge = size > SKILL_MD_MAX_BYTES
  const text = tooLarge ? '' : readFileSync(realFile, 'utf8')
  const parsed = parseSkillMarkdown(text)
  const files = listFiles(dir)
  const view: SkillView = {
    id,
    family,
    name,
    description: parsed.header?.description ?? '',
    origin,
    hasScripts: files.files.some((entry) => entry.executable),
    damaged: tooLarge || parsed.header === null || !isSkillName(name),
    sameNameAs: [],
    modifiedAt: Math.round(modifiedAt),
    contentHash: createHash('sha256').update(text).digest('hex').slice(0, 16)
  }
  return { view, dir, text }
}

/** Fichiers d'un skill (relatifs, sans suivre de lien), au plus `SKILL_FILES_MAX`. */
function listFiles(dir: string): { readonly files: SkillFileView[]; readonly truncated: boolean } {
  const files: SkillFileView[] = []
  const pending = ['']
  while (pending.length > 0) {
    const relative = pending.pop() as string
    let names: string[]
    try {
      names = readdirSync(join(dir, relative)).sort()
    } catch {
      continue
    }
    for (const name of names) {
      const path = relative === '' ? name : `${relative}/${name}`
      let stat: ReturnType<typeof lstatSync>
      try {
        stat = lstatSync(join(dir, path))
      } catch {
        continue
      }
      if (stat.isSymbolicLink()) continue
      if (stat.isDirectory()) {
        pending.push(path)
        continue
      }
      if (!stat.isFile()) continue
      if (files.length >= SKILL_FILES_MAX) return { files, truncated: true }
      const executable = isExecutablePath(path) || (process.platform !== 'win32' && (stat.mode & 0o111) !== 0)
      files.push({ path, size: stat.size, executable })
    }
  }
  return { files: files.sort((a, b) => (a.path < b.path ? -1 : 1)), truncated: false }
}
