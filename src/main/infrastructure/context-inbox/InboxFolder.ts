import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CONTEXT_FILES, MAX_CONTEXT_FILE_BYTES, type ContextFile } from '../../domain/context/bundle'

const MANIFEST = 'manifest.json'
const IMPORT_ID = /^[0-9a-f-]{36}$/

/** Dossier d'import déposé par Claude Code (`%APPDATA%/gestionnaire-idees/context-inbox/`) et son archive. */
export class InboxFolder {
  constructor(
    private readonly inboxDir: string,
    private readonly archiveDir: string
  ) {}

  get directory(): string {
    return this.inboxDir
  }

  readManifest(): string | null {
    const path = join(this.inboxDir, MANIFEST)
    if (!existsSync(path) || statSync(path).size > MAX_CONTEXT_FILE_BYTES) return null
    return readFileSync(path, 'utf8')
  }

  /** Ne lit que les noms de fichiers reconnus : aucun chemin arbitraire ne peut être atteint. */
  readFile(file: ContextFile): Buffer | null {
    if (!(CONTEXT_FILES as readonly string[]).includes(file)) return null
    const path = join(this.inboxDir, file)
    return existsSync(path) ? readFileSync(path) : null
  }

  /** Déplace tout le contenu du dossier d'import (fichiers reconnus ou non) vers l'archive de l'import. */
  archive(importId: string): void {
    if (!IMPORT_ID.test(importId)) throw new Error("Identifiant d'import invalide")
    const target = join(this.archiveDir, importId)
    mkdirSync(target, { recursive: true })
    for (const name of readdirSync(this.inboxDir)) renameSync(join(this.inboxDir, name), join(target, name))
  }
}
