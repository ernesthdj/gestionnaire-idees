/** Durée de vie d'un inventaire : la carte se redessine souvent, le dossier change rarement entre deux affichages. */
export const PROJECT_FILES_TTL_MS = 30_000

export interface ProjectFileIndexDeps {
  /** Inventaire du dossier : fichiers retenus (sans fichier sensible), chemins relatifs. */
  readonly scan: (root: string) => readonly string[]
  readonly now?: () => number
}

/**
 * Fichiers d'un dossier de projet, gardés 30 s par dossier (spec 017 D18) : le contenu des éléments d'une carte est
 * recalculé à chaque affichage sans reparcourir le disque à chaque fois. Un dossier illisible donne une liste vide.
 */
export class ProjectFileIndex {
  private readonly cache = new Map<string, { readonly at: number; readonly files: readonly string[] }>()

  constructor(private readonly deps: ProjectFileIndexDeps) {}

  files(root: string): readonly string[] {
    const now = (this.deps.now ?? Date.now)()
    const hit = this.cache.get(root)
    if (hit !== undefined && now - hit.at < PROJECT_FILES_TTL_MS) return hit.files
    let files: readonly string[]
    try {
      files = this.deps.scan(root)
    } catch {
      files = []
    }
    this.cache.set(root, { at: now, files })
    return files
  }
}
