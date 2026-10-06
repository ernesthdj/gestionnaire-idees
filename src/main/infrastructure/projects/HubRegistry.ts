import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { RegistryError } from '../../domain/projects/project'
import { AppError } from '../../domain/errors'

/**
 * Registre d'un workspace ProjectMaster (spec 016 D4) : `<workspace>/.hub/registry.json`, la racine des projets étant
 * `<workspace>/projects`. Lu et réécrit en entier, de façon atomique ; jamais écrit sur un JSON illisible.
 */
export class HubRegistry {
  /** Chemin du registre si `root` est le dossier des projets d'un workspace ProjectMaster ; sinon `null`. */
  static locate(root: string): string | null {
    const path = join(dirname(root), '.hub', 'registry.json')
    return existsSync(path) ? path : null
  }

  constructor(private readonly path: string) {}

  /** Applique `change` au registre ; `null` en retour : rien à écrire. */
  update(change: (registry: unknown) => unknown): void {
    let current: unknown
    try {
      current = JSON.parse(readFileSync(this.path, 'utf8'))
    } catch {
      throw new AppError('VALIDATION', 'Le registre ProjectMaster est illisible : rien n’a été écrit.')
    }
    let next: unknown
    try {
      next = change(current)
    } catch (error) {
      if (error instanceof RegistryError) throw new AppError('CONFLICT', error.message)
      throw error
    }
    if (next === null) return
    const temporary = `${this.path}.${process.pid}.tmp`
    writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    renameSync(temporary, this.path)
  }
}
