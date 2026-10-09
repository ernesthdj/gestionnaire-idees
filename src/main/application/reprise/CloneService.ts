import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, parse, resolve } from 'node:path'
import { checkGitUrl, type GitUrlCheck } from '@shared/reprise/gitUrl'
import type { GitLauncher, GitProcessResult } from '../../infrastructure/projects/GitProcess'

/**
 * Clone contrôlé d'un dépôt (spec 021 research R6 = spec 020 T027 = spec 017 T029) : UN service, deux profils.
 * - `superficiel` (bibliothèque de skills, spec 020 D12) : `--depth 1 --single-branch`, directement dans le dossier
 *   de version donné par l'appelant (jamais renommé ensuite), sinon une quarantaine du profil ; délai 15 min, garde-fou
 *   de 1 Go mesuré après le clone ;
 * - `historique` (reprise par lien) : `--filter=blob:none` (ou rien si « tout télécharger »), dossier choisi, 30 min.
 *
 * Sécurité (constitution I) : adresse contrôlée avant tout lancement (`gitUrl.ts`), git par chemin absolu sans shell,
 * arguments fixes avec `--` avant l'adresse, sans sous-modules ni hooks (`core.hooksPath` vers un dossier vide),
 * `core.fsmonitor` coupé, transports limités deux fois (`protocol.allow` et `GIT_ALLOW_PROTOCOL`), aucune invite
 * (`GIT_TERMINAL_PROMPT=0`). En cas d'échec ou d'annulation, seul le dossier créé par le clone est supprimé ; la cible
 * est inscrite au registre AVANT le lancement pour que `cleanupOrphans` (démarrage) la retrouve après un arrêt brutal.
 * La sortie de git (qui peut contenir l'adresse avec identifiant) n'est jamais renvoyée : seulement un code.
 */

export type CloneProfile = 'superficiel' | 'historique'

export type CloneFailureCode =
  | 'URL_REFUSED'
  | 'GIT_MISSING'
  | 'BUSY'
  | 'TARGET_EXISTS'
  | 'TARGET_REFUSED'
  | 'NOT_FOUND'
  | 'AUTH_FAILED'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'DISK_FULL'
  | 'INVALID_PATH'
  | 'TOO_LARGE'
  | 'FAILED'

export type ClonePhase = 'connexion' | 'reception' | 'resolution' | 'extraction'

export interface CloneProgress {
  readonly phase: ClonePhase
  readonly percent?: number
  readonly receivedBytes?: number
}

export interface CloneRequest {
  readonly url: string
  readonly profile: CloneProfile
  /**
   * Dossier cible absolu, absent, dans un parent existant ; `historique` : obligatoire ; `superficiel` : facultatif
   * (bibliothèque de skills, D12), une quarantaine du profil sinon.
   */
  readonly target?: string
  /** `historique` : « Tout télécharger » (clone sans filtre). */
  readonly full?: boolean
  readonly signal?: AbortSignal
  readonly onProgress?: (progress: CloneProgress) => void
}

export type CloneResult =
  | { readonly ok: true; readonly dir: string; readonly commit: string | null; readonly display: string }
  | {
      readonly ok: false
      readonly code: CloneFailureCode
      readonly display?: string
      /** Dossier créé que la suppression n'a pas pu retirer (à signaler à mentalyas). */
      readonly leftover?: string
    }

export interface CloneRegistryEntry {
  readonly id: string
  readonly target: string
  readonly profile?: CloneProfile
}

/** Clones en cours, persistés par l'appelant (table `git_clones_running`, spec 021) pour survivre à un arrêt brutal. */
export interface CloneRegistry {
  add(entry: CloneRegistryEntry): void | Promise<void>
  remove(id: string): void | Promise<void>
  list(): readonly CloneRegistryEntry[] | Promise<readonly CloneRegistryEntry[]>
}

/** Registre en mémoire (par défaut, et pour les tests) : ne survit pas à un redémarrage. */
export class MemoryCloneRegistry implements CloneRegistry {
  private readonly entries = new Map<string, string>()
  add(entry: CloneRegistryEntry): void {
    this.entries.set(entry.id, entry.target)
  }
  remove(id: string): void {
    this.entries.delete(id)
  }
  list(): readonly CloneRegistryEntry[] {
    return [...this.entries].map(([id, target]) => ({ id, target }))
  }
}

export interface CloneServiceDeps {
  /** Chemin absolu de git (`resolveGit`) ; `null` s'il est absent. */
  readonly git: () => string | null
  readonly launch: GitLauncher
  /** `<profil>/git-empty-hooks` : créé s'il manque, refusé s'il n'est pas vide. */
  readonly emptyHooksDir: string
  /** `<profil>/skill-library/.tmp` : un sous-dossier temporaire par clone superficiel. */
  readonly quarantineRoot: string
  readonly registry?: CloneRegistry
  readonly baseEnv?: Readonly<Record<string, string | undefined>>
  /** TESTS SEULEMENT : contrôle d'adresse et transports (production : `checkGitUrl`, `PRODUCTION_TRANSPORTS`). */
  readonly checkUrl?: (url: string) => GitUrlCheck
  readonly transports?: readonly string[]
  readonly timeoutsMs?: Partial<Record<CloneProfile, number>>
  readonly shallowLimits?: ShallowLimits
  readonly newId?: () => string
}

export interface ShallowLimits {
  readonly bytes: number
  readonly files: number
}

export const PRODUCTION_TRANSPORTS: readonly string[] = ['https', 'ssh']
export const CLONE_TIMEOUTS_MS: Readonly<Record<CloneProfile, number>> = {
  superficiel: 15 * 60_000,
  historique: 30 * 60_000
}
/** D12 : la bibliothèque garde le dépôt entier ; seul un garde-fou de taille reste (aucune borne de fichiers). */
export const SHALLOW_LIMITS: ShallowLimits = { bytes: 1024 ** 3, files: Number.POSITIVE_INFINITY }

/** Variables `GIT_*` héritées gardées : configuration et SSH propres au poste de mentalyas. */
const KEPT_GIT_ENV = new Set([
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_SYSTEM',
  'GIT_CONFIG_NOSYSTEM',
  'GIT_SSH',
  'GIT_SSH_COMMAND',
  'GIT_SSH_VARIANT'
])
const TRANSPORT = /^[a-z][a-z0-9+.-]{0,31}$/
const COMMIT = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/

export class CloneService {
  private running = false
  private readonly registry: CloneRegistry
  private readonly checkUrl: (url: string) => GitUrlCheck
  private readonly transports: readonly string[]

  constructor(private readonly deps: CloneServiceDeps) {
    this.registry = deps.registry ?? new MemoryCloneRegistry()
    this.checkUrl = deps.checkUrl ?? checkGitUrl
    this.transports = deps.transports ?? PRODUCTION_TRANSPORTS
    if (this.transports.length === 0 || !this.transports.every((name) => TRANSPORT.test(name))) {
      throw new Error('Transports git invalides')
    }
  }

  get busy(): boolean {
    return this.running
  }

  async clone(request: CloneRequest): Promise<CloneResult> {
    const check = this.checkUrl(request.url)
    if (!check.ok) return { ok: false, code: 'URL_REFUSED' }
    const display = check.display
    if (this.running) return { ok: false, code: 'BUSY', display }
    const program = this.deps.git()
    if (program === null) return { ok: false, code: 'GIT_MISSING', display }
    if (request.signal?.aborted === true) return { ok: false, code: 'CANCELLED', display }
    this.running = true
    try {
      return { ...(await this.run(program, check.url, request)), display }
    } finally {
      this.running = false
    }
  }

  /**
   * Démarrage : supprime les cibles restées au registre (clone interrompu par un arrêt brutal) et toute quarantaine
   * restante. Ne fait rien pendant un clone.
   */
  async cleanupOrphans(): Promise<{ readonly removed: number; readonly leftovers: readonly string[] }> {
    if (this.running) return { removed: 0, leftovers: [] }
    let removed = 0
    const leftovers: string[] = []
    for (const entry of await this.registry.list()) {
      if (!this.isRemovableTarget(entry.target)) {
        await this.registry.remove(entry.id)
        continue
      }
      if (await removeDir(entry.target)) {
        await this.registry.remove(entry.id)
        removed += 1
      } else leftovers.push(entry.target)
    }
    const names = await readdir(this.deps.quarantineRoot).catch((): string[] => [])
    for (const name of names) {
      const path = join(this.deps.quarantineRoot, name)
      if (await removeDir(path)) removed += 1
      else leftovers.push(path)
    }
    return { removed, leftovers }
  }

  private async run(program: string, url: string, request: CloneRequest): Promise<CloneResult> {
    const id = (this.deps.newId ?? randomUUID)()
    let target: string
    try {
      if (!(await this.prepareHooksDir())) return { ok: false, code: 'FAILED' }
      const resolved = await this.resolveTarget(id, request)
      if (typeof resolved !== 'string') return resolved
      target = resolved
    } catch {
      return { ok: false, code: 'FAILED' }
    }

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, this.deps.timeoutsMs?.[request.profile] ?? CLONE_TIMEOUTS_MS[request.profile])
    const onAbort = (): void => controller.abort()
    request.signal?.addEventListener('abort', onAbort, { once: true })
    const stopped = (): CloneFailureCode | null =>
      timedOut ? 'TIMEOUT' : request.signal?.aborted === true ? 'CANCELLED' : null

    let failure: CloneFailureCode | null
    let commit: string | null = null
    try {
      await this.registry.add({ id, target, profile: request.profile })
      notify(request, { phase: 'connexion' })
      const env = cloneEnv(this.deps.baseEnv ?? process.env, this.transports)
      const args = cloneArgs({
        profile: request.profile,
        full: request.full === true,
        hooksDir: this.deps.emptyHooksDir,
        transports: this.transports,
        url,
        target
      })
      const result = await this.deps.launch({
        program,
        args,
        cwd: dirname(target),
        env,
        signal: controller.signal,
        onStderr: (text) => {
          const progress = parseCloneProgress(text)
          if (progress !== null) notify(request, progress)
        }
      })
      failure = stopped() ?? outcomeFailure(result)
      if (failure === null && request.profile === 'superficiel') {
        if (await exceeds(target, this.deps.shallowLimits ?? SHALLOW_LIMITS)) failure = 'TOO_LARGE'
      }
      if (failure === null) {
        const head = await this.deps.launch({
          program,
          args: [...safePrefix(this.deps.emptyHooksDir, this.transports), '-C', target, 'rev-parse', 'HEAD'],
          cwd: target,
          env,
          signal: controller.signal
        })
        failure = stopped()
        const value = head.stdout.trim()
        if (failure === null && head.code === 0 && COMMIT.test(value)) commit = value
      }
    } catch {
      failure = stopped() ?? 'FAILED'
    } finally {
      clearTimeout(timer)
      request.signal?.removeEventListener('abort', onAbort)
    }

    if (failure === null) {
      await this.registry.remove(id)
      return { ok: true, dir: target, commit, display: '' }
    }
    if (await removeDir(target)) {
      await this.registry.remove(id)
      return { ok: false, code: failure }
    }
    return { ok: false, code: failure, leftover: target }
  }

  /** Dossier de hooks vide : un fichier qui y serait déposé deviendrait un hook exécuté par git. */
  private async prepareHooksDir(): Promise<boolean> {
    await mkdir(this.deps.emptyHooksDir, { recursive: true })
    return (await readdir(this.deps.emptyHooksDir)).length === 0
  }

  private async resolveTarget(id: string, request: CloneRequest): Promise<string | CloneResult> {
    let target: string
    if (request.profile === 'superficiel' && request.target === undefined) {
      await mkdir(this.deps.quarantineRoot, { recursive: true })
      target = join(this.deps.quarantineRoot, id)
    } else {
      const given = request.target ?? ''
      if (given === '' || !isAbsolute(given)) return { ok: false, code: 'TARGET_REFUSED' }
      target = resolve(given)
      if (!this.isRemovableTarget(target)) return { ok: false, code: 'TARGET_REFUSED' }
      try {
        if (!(await stat(dirname(target))).isDirectory()) return { ok: false, code: 'TARGET_REFUSED' }
      } catch {
        return { ok: false, code: 'TARGET_REFUSED' }
      }
    }
    if (await pathExists(target)) return { ok: false, code: 'TARGET_EXISTS' }
    return target
  }

  /** Jamais une racine de disque, ni les dossiers techniques du service eux-mêmes. */
  private isRemovableTarget(target: string): boolean {
    if (!isAbsolute(target)) return false
    const full = resolve(target)
    const same = (other: string): boolean => full.toLowerCase() === resolve(other).toLowerCase()
    return parse(full).root !== full && !same(this.deps.quarantineRoot) && !same(this.deps.emptyHooksDir)
  }
}

/** Préfixe sûr de toute commande git sur un dépôt cloné (spec 021 research R2, dépôt non de confiance). */
export function safePrefix(hooksDir: string, transports: readonly string[]): string[] {
  return [
    ...['-c', `core.hooksPath=${hooksDir}`, '-c', 'core.fsmonitor=false', '-c', 'core.quotepath=off'],
    ...['-c', 'color.ui=never', '-c', 'core.pager=cat', '-c', 'core.editor=false', '-c', 'protocol.allow=never'],
    ...transports.flatMap((name) => ['-c', `protocol.${name}.allow=always`])
  ]
}

export interface CloneArgsInput {
  readonly profile: CloneProfile
  readonly full: boolean
  readonly hooksDir: string
  readonly transports: readonly string[]
  readonly url: string
  readonly target: string
}

/** Arguments fixes du clone ; l'adresse et la cible viennent après `--` (jamais lues comme options). */
export function cloneArgs(input: CloneArgsInput): string[] {
  const profile =
    input.profile === 'superficiel' ? ['--depth', '1', '--single-branch'] : input.full ? [] : ['--filter=blob:none']
  return [
    ...safePrefix(input.hooksDir, input.transports),
    ...['clone', '--no-recurse-submodules', '--progress', ...profile],
    ...['--', input.url, input.target]
  ]
}

/** Environnement du clone : variables `GIT_*` héritées retirées (sauf configuration et SSH du poste), aucune invite. */
export function cloneEnv(
  base: Readonly<Record<string, string | undefined>>,
  transports: readonly string[]
): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) continue
    const upper = key.toUpperCase()
    if (upper.startsWith('GIT_') && !KEPT_GIT_ENV.has(upper)) continue
    if (upper === 'LC_ALL') continue
    env[key] = value
  }
  return {
    ...env,
    GIT_TERMINAL_PROMPT: '0',
    LC_ALL: 'C',
    GIT_LFS_SKIP_SMUDGE: '1',
    GIT_ALLOW_PROTOCOL: transports.join(':')
  }
}

/** Classe un échec de git d'après sa sortie d'erreur (messages anglais : `LC_ALL=C`). */
export function classifyCloneFailure(stderr: string): CloneFailureCode {
  const text = stderr.toLowerCase()
  const has = (...needles: string[]): boolean => needles.some((needle) => text.includes(needle))
  if (has('no space left on device', 'not enough space', 'disk quota exceeded')) return 'DISK_FULL'
  if (has('invalid path', 'filename too long')) return 'INVALID_PATH'
  if (/transport '[^']*' not allowed/.test(text)) return 'URL_REFUSED'
  if (
    has(
      'authentication failed',
      'could not read username',
      'could not read password',
      'terminal prompts disabled',
      'permission denied (publickey',
      'host key verification failed',
      'returned error: 401',
      'returned error: 403'
    )
  )
    return 'AUTH_FAILED'
  if (
    has('repository not found', 'does not appear to be a git repository', 'returned error: 404') ||
    /repository '[^']*' not found/.test(text)
  )
    return 'NOT_FOUND'
  if (
    has(
      'could not resolve host',
      'could not resolve hostname',
      'unable to access',
      'failed to connect',
      'connection timed out',
      'connection refused',
      'network is unreachable',
      'operation timed out',
      'the remote end hung up unexpectedly',
      'early eof',
      'ssl',
      'gnutls'
    )
  )
    return 'NETWORK'
  return 'FAILED'
}

const UNITS: Record<string, number> = { bytes: 1, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3 }

/** Dernière étape lisible dans un morceau de la sortie d'erreur de git (`--progress`), ou `null`. */
export function parseCloneProgress(chunk: string): CloneProgress | null {
  let last: CloneProgress | null = null
  for (const line of chunk.split(/[\r\n]+/)) {
    const receiving = /Receiving objects:\s+(\d{1,3})%(?:[^,]*,\s*([\d.]+)\s*(bytes|KiB|MiB|GiB))?/i.exec(line)
    if (receiving !== null) {
      const amount = receiving[2] === undefined ? undefined : Number(receiving[2])
      const unit = UNITS[(receiving[3] ?? '').toLowerCase()]
      last = {
        phase: 'reception',
        percent: Number(receiving[1]),
        ...(amount === undefined || unit === undefined ? {} : { receivedBytes: Math.round(amount * unit) })
      }
      continue
    }
    const resolving = /Resolving deltas:\s+(\d{1,3})%/i.exec(line)
    if (resolving !== null) {
      last = { phase: 'resolution', percent: Number(resolving[1]) }
      continue
    }
    const checkout = /(?:Updating files|Checking out files):\s+(\d{1,3})%/i.exec(line)
    if (checkout !== null) {
      last = { phase: 'extraction', percent: Number(checkout[1]) }
      continue
    }
    if (/^(?:Cloning into|remote: (?:Enumerating|Counting|Compressing))/i.test(line)) last = { phase: 'connexion' }
  }
  return last
}

function outcomeFailure(result: GitProcessResult): CloneFailureCode | null {
  if (result.spawnFailed) return 'GIT_MISSING'
  if (result.code === 0) return null
  return result.code === null ? 'FAILED' : classifyCloneFailure(result.stderr)
}

function notify(request: CloneRequest, progress: CloneProgress): void {
  try {
    request.onProgress?.(progress)
  } catch {
    // Un abonné défaillant n'interrompt pas le clone.
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch {
    return false
  }
}

/** Supprime un dossier (sans suivre les liens) ; `true` s'il n'existe plus. */
async function removeDir(path: string): Promise<boolean> {
  try {
    await rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch {
    // Vérifié ci-dessous.
  }
  return !(await pathExists(path))
}

/** Bornes du clone superficiel (fichiers et octets, liens symboliques non suivis) ; arrêt au premier dépassement. */
async function exceeds(root: string, limits: ShallowLimits): Promise<boolean> {
  let files = 0
  let bytes = 0
  const pending = [root]
  while (pending.length > 0) {
    const dir = pending.pop() ?? root
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) pending.push(path)
      else if (entry.isFile()) {
        files += 1
        bytes += (await lstat(path)).size
        if (files > limits.files || bytes > limits.bytes) return true
      }
    }
  }
  return false
}
