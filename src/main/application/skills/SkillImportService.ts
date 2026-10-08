import { createHash, randomUUID } from 'node:crypto'
import { lstatSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import type {
  LibraryRepoView,
  LibrarySkillDetailView,
  LibrarySkillView,
  LibraryVerdict,
  SkillImportProgressEvent
} from '@shared/ipc/skills'
import { checkGitUrl } from '@shared/reprise/gitUrl'
import type { SkillAuditOut } from '@shared/skills/audit'
import { parseSkillMarkdown } from '@shared/skills/frontMatter'
import { SKILL_MD_MAX_BYTES } from '@shared/skills/model'
import type { AIError, Result } from '../../domain/ai/types'
import { AppError } from '../../domain/errors'
import { AUDIT_REASONS_MAX, auditText, mostSevere, type AuditVerdict } from '../../domain/skills/auditRules'
import { isExecutablePath, isSkillName } from '../../domain/skills/paths'
import type {
  SkillCandidateRow,
  SkillImportRow,
  SkillRepository
} from '../../infrastructure/db/repositories/SkillRepository'
import type { AuditInput } from '../ai/SkillAuditTask'
import type { CloneRequest, CloneResult } from '../reprise/CloneService'
import type { DraftInput } from './SkillService'

/** Bornes du repérage et des brouillons (`L3-skills-importer.md` §2–3, spec 020 D12). */
export const IMPORT_LIMITS = { skills: 300, depth: 6, annexes: 20, annexChars: 100_000 } as const
/** Au-delà, un fichier entre dans l'empreinte par sa taille seulement. */
const HASH_MAX_BYTES = 5 * 1024 * 1024
/** Ancien dossier temporaire des clones (avant les versions de copie), sous la racine de la bibliothèque. */
const STAGING = '.tmp'

export interface SkillImportDeps {
  readonly repository: SkillRepository
  /** `<profil>/skill-library` : une copie par version de dépôt, `<hôte>/<auteur>/<dépôt>@<version>`. */
  readonly libraryRoot: string
  readonly clone: (request: CloneRequest) => Promise<CloneResult>
  /** Tâche `skill_audit` (Claude sans outil). */
  readonly audit: (
    input: AuditInput,
    requestId: string,
    signal: AbortSignal
  ) => Promise<Result<{ readonly data: SkillAuditOut }, AIError>>
  readonly writeDraft: (
    input: DraftInput,
    origin: 'import',
    options: { readonly importId: string; readonly scripts: readonly string[]; readonly source: string }
  ) => { draftId: string }
  /** Un skill personnel de ce nom existe-t-il déjà ? */
  readonly personalExists: (name: string) => boolean
  readonly emit: (event: SkillImportProgressEvent) => void
  /** Journal d'un échec : étape et code système seulement (jamais de chemin ni d'adresse). */
  readonly logFailure?: (fields: { readonly stage: string; readonly code: string }) => void
  /** TESTS SEULEMENT : suppression d'un dossier (production : `rmSync` récursif avec essais répétés). */
  readonly removeDir?: (path: string) => void
  readonly now?: () => number
  readonly newId?: () => string
}

interface Running {
  readonly id: string
  /** Dossier de cette version (`<hôte>/<auteur>/<dépôt>@<version>`). */
  readonly folder: string
  /** Dépôt (`<hôte>/<auteur>/<dépôt>`) : une mise à jour en cours bloque ce dépôt. */
  readonly key: string
  readonly controller: AbortController
  /** Clone en cours, tant qu'il n'est pas devenu la copie de la bibliothèque. */
  dir: string | null
  done: Promise<void>
}

interface Found {
  readonly name: string
  readonly relDir: string
  readonly files: { path: string; size: number; executable: boolean }[]
}

type Reason = { text: string; line?: number }

/**
 * Bibliothèque de skills importés depuis GitHub (spec 020 US4, D12, FR-024 à FR-033) : adresse contrôlée, clone
 * superficiel sans rien exécuter, directement dans le dossier de sa version (`<hôte>/<auteur>/<dépôt>@<version>`) ;
 * repérage des `SKILL.md` et règles fixes à l'import ; audit par Claude au clic Installer (le plus sévère l'emporte, une
 * seule fois par empreinte) ; « dangereux » verrouillé, scripts exclus par défaut. « Mettre à jour » = nouvelle version
 * du même dépôt : la base bascule dessus, puis l'ancienne copie est supprimée si possible. Aucun dossier n'est jamais
 * renommé (sous Windows, un dossier lu ne se renomme pas) ; une copie qui n'a pas pu être supprimée l'est au démarrage
 * suivant. Un import à la fois.
 */
export class SkillImportService {
  private running: Running | null = null

  constructor(private readonly deps: SkillImportDeps) {}

  /**
   * Au démarrage : un import resté « en cours » est marqué échoué, puis toute copie que la base ne référence plus
   * (version remplacée, dépôt retiré, clone interrompu) est supprimée.
   */
  recover(): void {
    this.deps.repository.failRunningImports(this.now())
    this.sweep()
  }

  /** Importe un dépôt dans la bibliothèque, ou le met à jour s'il y est déjà. */
  start(url: string): { importId: string } {
    const check = checkGitUrl(url.trim())
    if (!check.ok)
      throw new AppError('URL_REFUSED', 'Adresse refusée : seules https:// et git@ vers un dépôt sont acceptées')
    if (this.running !== null) throw new AppError('IMPORT_RUNNING', 'Un import est déjà en cours')
    const key = libraryFolder(check.host, check.owner, check.repo)
    const id = this.newId()
    const folder = `${key}@${id
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 12)
      .toLowerCase()}`
    this.deps.repository.insertImport({
      id,
      repo: check.display,
      commit: null,
      status: 'clone',
      errorCode: null,
      createdAt: this.now(),
      finishedAt: null,
      folder
    })
    const running: Running = {
      id,
      folder,
      key,
      controller: new AbortController(),
      dir: null,
      done: Promise.resolve()
    }
    this.running = running
    running.done = this.pipeline(running, check.url)
    return { importId: id }
  }

  cancel(importId: string): void {
    const running = this.running
    if (running?.id !== importId) return
    running.controller.abort()
    this.finish(importId, 'cancelled', 'CANCELLED')
  }

  /** Dépôts de la bibliothèque et leurs skills disponibles. */
  library(): LibraryRepoView[] {
    return this.deps.repository.libraryRepos().map((row) => ({
      repoId: row.id,
      repo: row.repo,
      commit: row.commit,
      updatedAt: row.updatedAt ?? row.createdAt,
      truncated: row.truncated,
      skippedCopies: row.skippedCopies,
      skills: this.deps.repository.candidates(row.id).map((candidate) => this.skillView(candidate))
    }))
  }

  librarySkill(candidateId: string): LibrarySkillDetailView {
    const { candidate, root } = this.locate(candidateId)
    return {
      skill: this.skillView(candidate),
      markdown: readText(join(root, candidate.relDir, 'SKILL.md'), SKILL_MD_MAX_BYTES) ?? ''
    }
  }

  /**
   * Installer un skill disponible : audit de Claude d'abord s'il n'a pas eu lieu sur ce contenu, puis brouillon (rien
   * n'est écrit dans les dossiers de skills avant « Installer » dans le brouillon). `seen` est le verdict que mentalyas
   * avait sous les yeux : s'il devient plus sévère, rien n'est créé et il doit reconfirmer.
   */
  async install(input: {
    readonly candidateId: string
    readonly scripts: readonly string[]
    readonly seen: LibraryVerdict
    readonly unlockDangerous?: boolean
  }): Promise<{ draftId: string; verdict: LibraryVerdict }> {
    const { candidate, repo, root } = this.locate(input.candidateId)
    const files = JSON.parse(candidate.files) as Found['files']
    for (const script of input.scripts) {
      if (!files.some((file) => file.path === script && file.executable)) {
        throw new AppError('VALIDATION', `Script inconnu : ${script}`)
      }
    }
    const dir = join(root, candidate.relDir)
    const hash = hashSkill(dir, files)
    if (hash !== candidate.contentHash) {
      throw new AppError('CHANGED', 'La copie de ce dépôt a changé : mets-le à jour avant d’installer.')
    }
    let current = candidate
    if (candidate.claudeHash !== hash) {
      const { skillMd, scripts } = readForAudit(dir, files)
      const claude = await this.deps.audit(
        { skillMd, files, scripts },
        `skill_audit:${repo.id}:${candidate.relDir}`,
        new AbortController().signal
      )
      // Une analyse impossible vaut « à revoir » (FR-026), gardée comme un audit pour ne pas bloquer l'installation.
      const audit = claude.ok
        ? {
            verdict: claude.value.data.verdict,
            reasons: claude.value.data.raisons.map((reason) => ({
              text: reason.texte,
              ...(reason.ligne === undefined ? {} : { line: reason.ligne })
            }))
          }
        : { verdict: 'a_revoir' as const, reasons: [{ text: 'Analyse par Claude impossible : à vérifier soi-même.' }] }
      this.deps.repository.setClaudeAudit(candidate.id, {
        verdict: audit.verdict,
        reasons: JSON.stringify(audit.reasons.slice(0, AUDIT_REASONS_MAX)),
        hash
      })
      current = this.deps.repository.candidate(candidate.id) ?? candidate
    }
    const verdict = this.skillView(current).verdict
    if (verdict !== input.seen && mostSevere(verdict, input.seen) === verdict) {
      throw new AppError(
        'VERDICT_CHANGED',
        `L’audit de Claude classe ce skill « ${VERDICT_LABELS[verdict]} » : relis ses raisons.`
      )
    }
    if (verdict === 'dangereux' && input.unlockDangerous !== true) {
      throw new AppError('DANGEROUS_LOCKED', `« ${candidate.name} » est classé dangereux : déverrouille-le d'abord`)
    }
    return { draftId: this.draftOf(dir, repo, current, files, input.scripts), verdict }
  }

  /** Retire un dépôt de la bibliothèque : copie et skills disponibles ; skills installés et brouillons intacts. */
  remove(repoId: string): void {
    const repo = this.deps.repository.importRow(repoId)
    if (repo?.status !== 'ready' || repo.folder === null) throw new AppError('NOT_FOUND', 'Dépôt introuvable')
    if (this.running?.key === repoKey(repo.folder))
      throw new AppError('IMPORT_RUNNING', 'Ce dépôt est en cours de mise à jour')
    // La base d'abord : le dépôt disparaît de la toile même si sa copie est encore lue (supprimée au démarrage suivant).
    this.deps.repository.deleteImport(repoId)
    this.removeCopy(repo.folder)
  }

  /** Attend la fin du travail en cours (tests, arrêt de l'app). */
  async idle(): Promise<void> {
    await this.running?.done
  }

  stop(): void {
    if (this.running !== null) this.cancel(this.running.id)
  }

  // --- Interne ---------------------------------------------------------------------------------------------------

  private async pipeline(running: Running, url: string): Promise<void> {
    const { id, controller } = running
    const fail = (code: string): void => {
      if (this.isFinished(id)) return
      this.finish(id, 'failed', code)
      this.deps.emit({ importId: id, step: 'echec', errorCode: code })
    }
    let stage = 'clone'
    try {
      this.deps.emit({ importId: id, step: 'clone' })
      const target = this.libraryPath(running.folder)
      mkdirSync(dirname(target), { recursive: true })
      running.dir = target
      const cloned = await this.deps.clone({ url, profile: 'superficiel', target, signal: controller.signal })
      if (!cloned.ok) {
        this.deps.logFailure?.({ stage, code: cloned.code })
        return fail(cloned.code)
      }
      stage = 'reperage'
      if (controller.signal.aborted) return this.removeStaging(running)
      this.deps.repository.updateImport(id, { status: 'reperage', commit: cloned.commit })
      this.deps.emit({ importId: id, step: 'reperage' })
      const { skills: found, truncated, skippedCopies } = findSkills(cloned.dir)
      if (found.length === 0) return fail('NO_SKILL')
      this.deps.repository.updateImport(id, { status: 'audit' })
      this.deps.emit({ importId: id, step: 'audit', done: 0, total: found.length })
      const previous = this.deps.repository
        .libraryRepos()
        .find((row) => row.id !== id && row.folder !== null && repoKey(row.folder) === running.key)
      const audited = new Map(
        (previous === undefined ? [] : this.deps.repository.candidates(previous.id)).map((row) => [row.relDir, row])
      )
      const rows = found.map((skill) => this.candidateOf(id, cloned.dir, skill, audited.get(skill.relDir)))
      if (controller.signal.aborted) return
      stage = 'base'
      const at = this.now()
      this.deps.repository.transaction(() => {
        this.deps.repository.insertCandidates(rows)
        this.deps.repository.updateImport(id, {
          status: 'ready',
          updatedAt: at,
          finishedAt: at,
          truncated,
          skippedCopies
        })
        if (previous !== undefined) this.deps.repository.deleteImport(previous.id)
      })
      running.dir = null
      this.running = null
      if (previous?.folder != null) this.removeCopy(previous.folder)
      this.deps.emit({ importId: id, step: 'pret', done: found.length, total: found.length })
    } catch (error) {
      this.deps.logFailure?.({ stage, code: errorCode(error) })
      // L'ancienne version reste la copie de la bibliothèque ; le clone de la nouvelle est supprimé.
      fail('IMPORT_FAILED')
    }
  }

  /** Skill trouvé : empreinte et règles fixes ; l'audit de Claude d'avant est repris si le contenu n'a pas changé. */
  private candidateOf(importId: string, root: string, skill: Found, before?: SkillCandidateRow): SkillCandidateRow {
    const dir = join(root, skill.relDir)
    const { skillMd, scripts } = readForAudit(dir, skill.files)
    const fixed = [skillMd, ...scripts.map((script) => script.content)].map(auditText)
    const verdict = fixed.reduce<AuditVerdict>((worst, result) => mostSevere(worst, result.verdict), 'sur')
    const reasons = fixed.flatMap((result) => result.raisons.map((reason) => ({ ...reason })))
    const parsed = parseSkillMarkdown(skillMd)
    const hash = hashSkill(dir, skill.files)
    const keep = before !== undefined && before.claudeHash === hash
    return {
      id: this.newId(),
      importId,
      name: skill.name,
      relDir: skill.relDir,
      files: JSON.stringify(skill.files),
      verdict,
      // Première entrée : la description du skill (pas de colonne dédiée), puis les raisons des règles fixes.
      reasons: JSON.stringify([{ text: parsed.header?.description ?? '' }, ...reasons].slice(0, AUDIT_REASONS_MAX + 1)),
      kept: false,
      contentHash: hash,
      claudeVerdict: keep ? before.claudeVerdict : null,
      claudeReasons: keep ? before.claudeReasons : null,
      claudeHash: keep ? before.claudeHash : null
    }
  }

  private skillView(row: SkillCandidateRow): LibrarySkillView {
    const [header, ...reasons] = JSON.parse(row.reasons) as Reason[]
    const claude = row.claudeVerdict !== null && row.claudeHash !== null && row.claudeHash === row.contentHash
    return {
      candidateId: row.id,
      repoId: row.importId,
      name: row.name,
      description: header?.text ?? '',
      files: JSON.parse(row.files) as LibrarySkillView['files'],
      verdict: claude ? mostSevere(row.verdict, row.claudeVerdict as AuditVerdict) : row.verdict,
      reasons: [...reasons, ...(claude ? (JSON.parse(row.claudeReasons ?? '[]') as Reason[]) : [])],
      auditedByClaude: claude,
      installed: this.deps.personalExists(row.name)
    }
  }

  /** Skill disponible, son dépôt et la racine de sa copie ; refusé pendant la mise à jour de ce dépôt. */
  private locate(candidateId: string): { candidate: SkillCandidateRow; repo: SkillImportRow; root: string } {
    const candidate = this.deps.repository.candidate(candidateId)
    const repo = candidate === undefined ? undefined : this.deps.repository.importRow(candidate.importId)
    if (candidate === undefined || repo?.status !== 'ready' || repo.folder === null) {
      throw new AppError('NOT_FOUND', 'Skill introuvable dans la bibliothèque')
    }
    if (this.running?.key === repoKey(repo.folder))
      throw new AppError('IMPORT_RUNNING', 'Ce dépôt est en cours de mise à jour')
    const root = this.libraryPath(repo.folder)
    if (!isInside(root, join(root, candidate.relDir)) && candidate.relDir !== '') {
      throw new AppError('NOT_FOUND', 'Skill introuvable dans la bibliothèque')
    }
    return { candidate, repo, root }
  }

  private draftOf(
    dir: string,
    repo: SkillImportRow,
    candidate: SkillCandidateRow,
    files: Found['files'],
    scripts: readonly string[]
  ): string {
    const parsed = parseSkillMarkdown(readText(join(dir, 'SKILL.md'), SKILL_MD_MAX_BYTES) ?? '')
    const allowed = new Set(scripts)
    const annexes = files
      .filter((file) => file.path !== 'SKILL.md' && (!file.executable || allowed.has(file.path)))
      .slice(0, IMPORT_LIMITS.annexes)
      .flatMap((file) => {
        const content = readText(join(dir, file.path), IMPORT_LIMITS.annexChars)
        return content === null ? [] : [{ chemin: file.path, contenu: content }]
      })
    const { draftId } = this.deps.writeDraft(
      {
        skill: candidate.name,
        famille: 'perso',
        description: parsed.header?.description ?? candidate.name,
        contenu: parsed.body.trim() === '' ? `# ${candidate.name}\n` : parsed.body,
        annexes
      },
      'import',
      {
        importId: repo.id,
        scripts: annexes.filter((annex) => allowed.has(annex.chemin)).map((annex) => annex.chemin),
        source: JSON.stringify({ repo: repo.repo, commit: repo.commit, path: candidate.relDir })
      }
    )
    return draftId
  }

  /** Supprime une copie qui n'est plus référencée ; si elle est encore lue, le nettoyage de démarrage s'en charge. */
  private removeCopy(folder: string): void {
    let target: string
    try {
      target = this.libraryPath(folder)
    } catch {
      return
    }
    try {
      ;(this.deps.removeDir ?? removeDirSync)(target)
    } catch (error) {
      this.deps.logFailure?.({ stage: 'nettoyage', code: errorCode(error) })
      return
    }
    this.pruneEmptyParents(target)
  }

  /**
   * Nettoyage de démarrage : sous `<hôte>/<auteur>/`, toute copie que la base ne référence plus est supprimée ; une copie
   * référencée (et tout ce qu'elle contient) n'est jamais touchée. L'ancien dossier temporaire part aussi.
   */
  private sweep(): void {
    const root = resolve(this.deps.libraryRoot)
    const kept = new Set(
      this.deps.repository
        .libraryRepos()
        .flatMap((row) => (row.folder === null ? [] : [resolve(root, row.folder).toLowerCase()]))
    )
    const dirs = (path: string): string[] => {
      try {
        return readdirSync(path, { withFileTypes: true })
          .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
          .map((entry) => join(path, entry.name))
      } catch {
        return []
      }
    }
    for (const host of dirs(root)) {
      if (host.toLowerCase() === join(root, STAGING).toLowerCase()) {
        this.removeQuietly(host)
        continue
      }
      for (const owner of dirs(host)) {
        for (const copy of dirs(owner)) if (!kept.has(copy.toLowerCase())) this.removeQuietly(copy)
        this.pruneEmptyParents(join(owner, '_'))
      }
    }
  }

  private removeQuietly(path: string): void {
    try {
      ;(this.deps.removeDir ?? removeDirSync)(path)
    } catch (error) {
      this.deps.logFailure?.({ stage: 'nettoyage', code: errorCode(error) })
    }
  }

  /** Chemin absolu d'une copie, toujours sous la racine de la bibliothèque et hors du dossier temporaire. */
  private libraryPath(folder: string): string {
    const root = resolve(this.deps.libraryRoot)
    const full = resolve(root, folder)
    if (!isInside(root, full) || isInside(join(root, STAGING), full) || full === join(root, STAGING)) {
      throw new AppError('NOT_FOUND', 'Dossier de bibliothèque invalide')
    }
    return full
  }

  /** Après un retrait : dossiers `<auteur>` puis `<hôte>` supprimés s'ils sont vides. */
  private pruneEmptyParents(target: string): void {
    const root = resolve(this.deps.libraryRoot)
    for (let dir = dirname(target); isInside(root, dir); dir = dirname(dir)) {
      try {
        if (readdirSync(dir).length > 0) return
        rmdirSync(dir)
      } catch {
        return
      }
    }
  }

  private finish(importId: string, status: 'cancelled' | 'failed', errorCode: string): void {
    this.deps.repository.updateImport(importId, { status, errorCode, finishedAt: this.now() })
    const running = this.running
    if (running?.id === importId) {
      this.removeStaging(running)
      this.running = null
    }
  }

  private removeStaging(running: Running): void {
    if (running.dir !== null) this.removeQuietly(running.dir)
    running.dir = null
  }

  private isFinished(importId: string): boolean {
    const status = this.deps.repository.importRow(importId)?.status
    return status === 'ready' || status === 'cancelled' || status === 'failed'
  }

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }

  private newId(): string {
    return (this.deps.newId ?? randomUUID)()
  }
}

const VERDICT_LABELS: Readonly<Record<LibraryVerdict, string>> = {
  sur: 'sûr',
  a_revoir: 'à revoir',
  dangereux: 'dangereux'
}

/** Dépôt d'un dossier de copie : `<hôte>/<auteur>/<dépôt>@<version>` → `<hôte>/<auteur>/<dépôt>`. */
function repoKey(folder: string): string {
  return folder.split('@')[0] ?? folder
}

/** Code système d'une erreur (`EPERM`…), sans son message (qui contient des chemins). */
function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'ERREUR'
}

function removeDirSync(path: string): void {
  rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}

/** `full` est-il strictement sous `root` ? (comparaison insensible à la casse : Windows) */
function isInside(root: string, full: string): boolean {
  const base = resolve(root).toLowerCase()
  const path = resolve(full).toLowerCase()
  return path.startsWith(base.endsWith(sep) ? base : base + sep)
}

/** Segment de dossier sûr : minuscules, `[a-z0-9._-]`, jamais vide ni `.` / `..`. */
function segment(value: string): string {
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 100)
  return clean === '' ? '_' : clean
}

/** Dépôt dans la bibliothèque : `<hôte>/<auteur>/<dépôt>` (même dépôt → même clé ; `@` n'y figure jamais). */
export function libraryFolder(host: string, owner?: string, repo?: string): string {
  return [host, owner ?? '_', repo ?? 'depot'].map(segment).join('/')
}

/** SKILL.md et scripts d'un skill, lus pour les règles fixes et l'audit de Claude. */
function readForAudit(
  dir: string,
  files: Found['files']
): { skillMd: string; scripts: { path: string; content: string }[] } {
  return {
    skillMd: readText(join(dir, 'SKILL.md'), SKILL_MD_MAX_BYTES) ?? '',
    scripts: files
      .filter((file) => file.executable)
      .map((file) => ({ path: file.path, content: readText(join(dir, file.path), 200_000) ?? '' }))
  }
}

/** Empreinte des fichiers d'un skill (chemins triés, contenus ; taille seule au-delà de 5 Mo). */
function hashSkill(dir: string, files: Found['files']): string {
  const hash = createHash('sha256')
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    hash.update(`${file.path}\0`)
    try {
      const stat = lstatSync(join(dir, file.path))
      hash.update(
        stat.isFile() && stat.size <= HASH_MAX_BYTES ? readFileSync(join(dir, file.path)) : `taille:${stat.size}`
      )
    } catch {
      hash.update('absent')
    }
    hash.update('\0')
  }
  return hash.digest('hex')
}

/** Texte d'un fichier (UTF-8), `null` s'il est trop gros, illisible ou binaire. */
function readText(path: string, maxBytes: number): string | null {
  try {
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.size > maxBytes) return null
    const buffer = readFileSync(path)
    return buffer.includes(0) ? null : buffer.toString('utf8')
  } catch {
    return null
  }
}

/** Nom de dossier ramené à la forme d'un skill (`My_Skill` → `my-skill`). */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

/**
 * Repérage pur sur le disque d'un clone : chaque `SKILL.md` à profondeur ≤ 6, sans suivre de lien ; un skill par nom,
 * à l'emplacement le plus canonique (`skippedCopies` = copies écartées : traductions, autres outils) ; au plus 300
 * skills (`truncated` au-delà).
 */
export function findSkills(root: string): { skills: Found[]; truncated: boolean; skippedCopies: number } {
  const found: Found[] = []
  const walk = (relative: string, depth: number): string[] => {
    const out: string[] = []
    let names: string[]
    try {
      names = readdirSync(join(root, relative)).sort()
    } catch {
      return out
    }
    for (const name of names) {
      if (name === '.git' || name === 'node_modules') continue
      const path = relative === '' ? name : `${relative}/${name}`
      const stat = lstatSync(join(root, path))
      if (stat.isSymbolicLink()) continue
      if (stat.isDirectory()) {
        if (depth < IMPORT_LIMITS.depth + 2) out.push(...walk(path, depth + 1))
      } else if (stat.isFile()) {
        out.push(path)
      }
    }
    return out
  }
  const all = walk('', 0)
  const skillDirs = all
    .filter((path) => path === 'SKILL.md' || path.endsWith('/SKILL.md'))
    .map((path) => path.slice(0, Math.max(0, path.length - 'SKILL.md'.length - 1)))
    .filter((dir) => dir.split('/').filter((part) => part !== '').length <= IMPORT_LIMITS.depth)
  // Un skill par nom, pris à l'emplacement le plus canonique : les copies (traductions, autres outils) sont écartées.
  const named = skillDirs
    .map((relDir) => ({
      relDir,
      name: normalizeName(relDir === '' ? 'skill-importe' : (relDir.split('/').at(-1) ?? relDir)),
      rank: placeRank(relDir)
    }))
    .filter((skill) => isSkillName(skill.name))
    .sort((a, b) => a.rank - b.rank || (a.relDir < b.relDir ? -1 : 1))
  const seen = new Set<string>()
  const unique = named.filter((skill) => !seen.has(skill.name) && seen.add(skill.name) !== undefined)
  for (const { relDir, name } of unique.slice(0, IMPORT_LIMITS.skills)) {
    const prefix = relDir === '' ? '' : `${relDir}/`
    const own = all
      .filter((path) => path.startsWith(prefix))
      .map((path) => path.slice(prefix.length))
      // Les fichiers d'un skill imbriqué appartiennent à ce skill-là.
      .filter((path) => !skillDirs.some((other) => other !== relDir && `${prefix}${path}`.startsWith(`${other}/`)))
    found.push({
      name,
      relDir,
      files: own.map((path) => ({
        path,
        size: lstatSync(join(root, prefix, path)).size,
        executable: isExecutablePath(path)
      }))
    })
  }
  return {
    skills: found,
    truncated: unique.length > IMPORT_LIMITS.skills,
    skippedCopies: named.length - unique.length
  }
}

/** Dossiers de documentation ou de traduction : leurs skills sont des copies. */
const DOC_ROOTS = new Set(['docs', 'doc', 'i18n', 'locales', 'translations'])
/** Segment de langue à région (`ja-JP`, `zh_CN`) : copie traduite. */
const LOCALE = /^[a-z]{2,3}[-_][a-z]{2,4}$/i

/**
 * Rang d'un emplacement de skill (0 = le plus canonique) : `skills/` ou `.claude/skills/` à la racine, puis le reste
 * du dépôt, puis la documentation et les traductions.
 */
function placeRank(relDir: string): number {
  const parts = relDir.split('/')
  if (relDir === '' || parts[0] === 'skills' || (parts[0] === '.claude' && parts[1] === 'skills')) return 0
  if (DOC_ROOTS.has((parts[0] ?? '').toLowerCase()) || parts.some((part) => LOCALE.test(part))) return 2
  return 1
}
