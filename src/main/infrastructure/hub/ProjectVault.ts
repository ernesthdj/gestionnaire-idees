import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

/**
 * Vault d'un projet en chantier (spec 024 R7) : `.brainstormer/` posé dans le dossier du projet, avec seulement des
 * métadonnées (identité du brainstorm, rôle git, sessions) ; le contenu de la carte reste dans la base chiffrée. Lu et
 * revalidé par Zod ; un vault abîmé est signalé, jamais réécrit. Ignoré par git (`.gitignore`).
 */

export const VAULT_DIR = '.brainstormer'
const IGNORE_LINE = `${VAULT_DIR}/`
const MAX_BYTES = 64 * 1024

const VaultSchema = z.looseObject({
  version: z.literal(1),
  brainstormId: z.uuid(),
  name: z.string().min(1).max(120),
  gitRole: z.enum(['owner', 'collaborator', 'none']),
  workBranch: z.string().max(200).nullable(),
  createdAt: z.string().max(40)
})

export type VaultData = z.infer<typeof VaultSchema>

export type VaultRead =
  { readonly state: 'none' } | { readonly state: 'ok'; readonly data: VaultData } | { readonly state: 'damaged' }

export function readVault(dir: string): VaultRead {
  const path = join(dir, VAULT_DIR, 'brainstorm.json')
  if (!existsSync(path)) return existsSync(join(dir, VAULT_DIR)) ? { state: 'damaged' } : { state: 'none' }
  try {
    if (statSync(path).size > MAX_BYTES) return { state: 'damaged' }
    const parsed = VaultSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')))
    return parsed.success ? { state: 'ok', data: parsed.data } : { state: 'damaged' }
  } catch {
    return { state: 'damaged' }
  }
}

/** `.gitignore` du projet : contient-il déjà le vault ? */
export function ignoresVault(dir: string): boolean {
  const path = join(dir, '.gitignore')
  if (!existsSync(path)) return false
  try {
    return readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .some((line) => [IGNORE_LINE, VAULT_DIR, `/${VAULT_DIR}`, `/${IGNORE_LINE}`].includes(line.trim()))
  } catch {
    return false
  }
}

/** Ce que l'app écrira dans le projet (montré avant toute écriture). */
export function vaultWrites(dir: string): string[] {
  const writes: string[] = []
  if (readVault(dir).state === 'none') writes.push(`${VAULT_DIR}/brainstorm.json`, `${VAULT_DIR}/sessions.json`)
  if (!ignoresVault(dir)) {
    writes.push(
      existsSync(join(dir, '.gitignore')) ? '.gitignore (une ligne ajoutée : .brainstormer/)' : '.gitignore (créé)'
    )
  }
  return writes
}

const atomicWrite = (path: string, text: string): void => {
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, text, 'utf8')
  renameSync(temporary, path)
}

/** Pose le vault (s'il manque) et la ligne du `.gitignore` ; jamais sur un vault existant. */
export function createVault(dir: string, data: VaultData): void {
  if (readVault(dir).state !== 'none') throw new Error('vault déjà présent')
  mkdirSync(join(dir, VAULT_DIR), { recursive: true })
  atomicWrite(join(dir, VAULT_DIR, 'brainstorm.json'), `${JSON.stringify(data, null, 2)}\n`)
  atomicWrite(
    join(dir, VAULT_DIR, 'sessions.json'),
    `${JSON.stringify({ version: '1.0', active_session: null, sessions: [] }, null, 2)}\n`
  )
  ensureIgnored(dir)
}

export function ensureIgnored(dir: string): void {
  if (ignoresVault(dir)) return
  const path = join(dir, '.gitignore')
  if (!existsSync(path)) {
    writeFileSync(path, `${IGNORE_LINE}\n`, 'utf8')
    return
  }
  const current = readFileSync(path, 'utf8')
  const newline = current.includes('\r\n') ? '\r\n' : '\n'
  const separator = current === '' || current.endsWith('\n') ? '' : newline
  writeFileSync(path, `${current}${separator}${IGNORE_LINE}${newline}`, 'utf8')
}

/** Branche courante lue dans `.git/HEAD` (sans lancer git) ; `null` : pas de dépôt, HEAD détachée ou illisible. */
export function gitBranchOf(dir: string): { readonly isRepo: boolean; readonly branch: string | null } {
  const git = join(dir, '.git')
  if (!existsSync(git)) return { isRepo: false, branch: null }
  try {
    if (!statSync(git).isDirectory()) return { isRepo: true, branch: null }
    const head = readFileSync(join(git, 'HEAD'), 'utf8').trim()
    const match = /^ref: refs\/heads\/([^\s]{1,200})$/.exec(head)
    return { isRepo: true, branch: match?.[1] ?? null }
  } catch {
    return { isRepo: true, branch: null }
  }
}
