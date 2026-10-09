import { existsSync, realpathSync } from 'node:fs'
import { basename, isAbsolute, join, relative } from 'node:path'
import type { BrainstormRepository } from '../../infrastructure/db/repositories/BrainstormRepository'
import { freeSlug } from './BrainstormService'

export interface LegacyMigrationDeps {
  readonly repository: BrainstormRepository
  /** Dossier `projects/` du coffre ; `null` : aucun (tout projet lié est alors externe). */
  readonly projectsRoot: () => string | null
}

export interface LegacyMigrationReport {
  /** Genesis rattachés à un brainstorm de projet (un par dossier lié). */
  readonly linked: number
  /** Genesis sans dossier, rangés dans « Idées en vrac ». */
  readonly loose: number
  readonly blocks: number
  readonly created: number
}

const real = (path: string): string => {
  try {
    return realpathSync.native(path)
  } catch {
    return path
  }
}

/**
 * Passage de la carte unique aux brainstorms (spec 024 R10, SC-008) : chaque genesis lié à un dossier rejoint le
 * brainstorm de ce dossier (créé au besoin, dans le coffre ou externe) ; les genesis sans dossier et les blocs restants
 * vont dans « Idées en vrac ». Rien n'est supprimé ni déplacé ; joué à chaque démarrage, sans effet s'il n'y a rien.
 */
export function migrateLegacyCanvas(deps: LegacyMigrationDeps): LegacyMigrationReport {
  const { repository } = deps
  return repository.transaction(() => {
    const root = deps.projectsRoot()
    const rootReal = root === null ? null : real(root)
    let linked = 0
    let loose = 0
    let created = 0
    for (const genesis of repository.orphanRoots()) {
      const dir = genesis.projectDir === null || !existsSync(genesis.projectDir) ? null : real(genesis.projectDir)
      if (dir === null) {
        repository.assignRoot(genesis.id, repository.ensureLoose())
        loose += 1
        continue
      }
      let brainstorm = repository.byFolder(dir)
      if (brainstorm === undefined) {
        const rel = rootReal === null ? null : relative(rootReal, dir)
        const inVault = rel !== null && rel !== '' && !rel.startsWith('..') && !isAbsolute(rel) && !rel.includes('\\')
        brainstorm = repository.insert({
          name: genesis.title.slice(0, 120) || basename(dir),
          slug: freeSlug(basename(dir), (slug) => repository.bySlug(slug) !== undefined),
          description: '',
          type: null,
          location: inVault ? 'vault' : 'external',
          origin: 'migrated',
          folderPath: dir,
          gitRole: existsSync(join(dir, '.git')) ? 'owner' : 'none',
          github: false
        })
        created += 1
      }
      repository.assignRoot(genesis.id, brainstorm.id)
      linked += 1
    }
    const orphanBlocks = repository.countOrphanBlocks()
    const blocks = orphanBlocks === 0 ? 0 : repository.assignOrphanBlocks(repository.ensureLoose())
    return { linked, loose, blocks, created }
  })
}
