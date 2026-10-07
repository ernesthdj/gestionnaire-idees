import { randomUUID } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { AppError } from '../../domain/errors'
import { filesHash, type DraftFile } from '../../domain/skills/draftFiles'
import { safeRelativePath } from '../../domain/skills/paths'

/** Bornes d'un skill lu pour une version (au-delà : refus, rien n'est copié à moitié). */
const MAX_FILES = 300
const MAX_BYTES = 10 * 1024 * 1024

/** Nom de dossier sûr pour un identifiant de skill (`perso:hub` → `perso_hub`). */
const safeKey = (skillId: string): string => skillId.replace(/[^a-z0-9-]/gi, '_').slice(0, 180)

/**
 * Fichiers des skills sur le disque (spec 020 research R6) : lecture sans suivre de lien, versions par empreinte dans
 * le profil, écriture **atomique** par dossier (préparation dans un dossier caché voisin, puis échange de noms) : un
 * skill n'est jamais à moitié écrit. Les dossiers préparés commencent par un point : l'inventaire les ignore.
 */
export class SkillStore {
  constructor(private readonly versionsRoot: string) {}

  /** Fichiers d'un dossier de skill (chemin relatif → contenu), `null` s'il n'existe pas. */
  read(dir: string): Map<string, Buffer> | null {
    if (!existsSync(dir)) return null
    const files = new Map<string, Buffer>()
    let total = 0
    const pending = ['']
    while (pending.length > 0) {
      const relative = pending.pop() as string
      for (const name of readdirSync(join(dir, relative)).sort()) {
        const path = relative === '' ? name : `${relative}/${name}`
        const stat = lstatSync(join(dir, path))
        if (stat.isSymbolicLink()) continue
        if (stat.isDirectory()) {
          pending.push(path)
          continue
        }
        if (!stat.isFile()) continue
        total += stat.size
        if (files.size >= MAX_FILES || total > MAX_BYTES) {
          throw new AppError('TOO_LARGE', 'Skill trop volumineux pour être versionné')
        }
        files.set(path, readFileSync(join(dir, path)))
      }
    }
    return files
  }

  /** Empreinte de l'état d'un skill, `null` s'il n'existe pas. */
  hash(dir: string): string | null {
    const files = this.read(dir)
    return files === null ? null : filesHash(files)
  }

  /** Sauvegarde l'état actuel d'un skill (s'il existe) ; renvoie le dossier relatif et l'empreinte. */
  saveVersion(skillId: string, dir: string): { readonly folder: string; readonly hash: string } | null {
    const files = this.read(dir)
    if (files === null) return null
    const hash = filesHash(files)
    const folder = `${safeKey(skillId)}/${hash}`
    const target = join(this.versionsRoot, folder)
    if (!existsSync(target)) {
      const staging = join(this.versionsRoot, safeKey(skillId), `.tmp-${randomUUID()}`)
      writeAll(staging, files)
      renameSync(staging, target)
    }
    return { folder, hash }
  }

  /** Une version sauvegardée existe-t-elle encore sur le disque ? */
  hasVersionFolder(folder: string): boolean {
    return existsSync(join(this.versionsRoot, folder))
  }

  /** Écrit les fichiers d'un brouillon dans le skill (les autres fichiers du skill sont gardés). */
  write(dir: string, files: readonly DraftFile[]): void {
    const current = this.read(dir) ?? new Map<string, Buffer>()
    for (const file of files) {
      const path = safeRelativePath(file.path)
      if (path === null) throw new AppError('VALIDATION', 'Chemin de fichier refusé')
      current.set(path, Buffer.from(file.content, 'utf8'))
    }
    this.replace(dir, current)
  }

  /** Rétablit un skill à l'état d'une version sauvegardée. */
  restore(dir: string, folder: string): void {
    const files = this.read(join(this.versionsRoot, folder))
    if (files === null) throw new AppError('NO_VERSION', 'Cette version n’existe plus')
    this.replace(dir, files)
  }

  /** Retire le dossier d'un skill (sa version doit avoir été sauvegardée avant). */
  remove(dir: string): void {
    if (!existsSync(dir)) return
    const old = join(dirname(dir), `.old-${randomUUID()}`)
    renameSync(dir, old)
    rmSync(old, { recursive: true, force: true })
  }

  deleteVersionFolder(folder: string): void {
    rmSync(join(this.versionsRoot, folder), { recursive: true, force: true })
  }

  private replace(dir: string, files: ReadonlyMap<string, Buffer>): void {
    const parent = dirname(dir)
    mkdirSync(parent, { recursive: true })
    const staging = join(parent, `.tmp-${randomUUID()}`)
    try {
      writeAll(staging, files)
    } catch (error) {
      rmSync(staging, { recursive: true, force: true })
      throw error
    }
    const old = join(parent, `.old-${randomUUID()}`)
    const existed = existsSync(dir)
    if (existed) renameSync(dir, old)
    try {
      renameSync(staging, dir)
    } catch (error) {
      // Échange impossible : l'ancien dossier reprend sa place, rien n'est perdu.
      if (existed) renameSync(old, dir)
      rmSync(staging, { recursive: true, force: true })
      throw error
    }
    if (existed) rmSync(old, { recursive: true, force: true })
  }
}

function writeAll(root: string, files: ReadonlyMap<string, Buffer>): void {
  mkdirSync(root, { recursive: true })
  for (const [path, content] of files) {
    const target = join(root, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
  }
}
