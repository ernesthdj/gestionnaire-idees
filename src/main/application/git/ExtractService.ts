import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative } from 'node:path'
import type { ExtractPreviewView } from '@shared/git/extract'
import { attributionHeader, canAttribute, studyNote, type ExtractOrigin } from '../../domain/git/attribution'
import { detectLicense, LICENSE_FILE } from '../../domain/git/license'
import { AppError } from '../../domain/errors'
import { classifyFile } from '../../domain/reprise/fileFilter'
import type { GitRepository } from '../../infrastructure/db/repositories/GitRepository'
import { HubRegistry } from '../../infrastructure/projects/HubRegistry'
import type { GitAccess } from './GitAccess'

export interface ExtractDeps {
  readonly access: GitAccess
  readonly repository: Pick<GitRepository, 'repo' | 'logOperation'>
  /** Dossier des projets (spec 016) ; le workspace est son parent s'il porte un registre `/hub`. */
  readonly projectsRoot: () => string | null
  readonly now?: () => Date
}

/** Fichier extrait au plus (R16). */
export const EXTRACT_MAX_BYTES = 200 * 1024
const ROOTS = ['snippets', 'techno'] as const
const FOLDER = /^[a-z0-9-]{1,40}$/
type Root = (typeof ROOTS)[number]

const inside = (parent: string, child: string): boolean => {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * Extraire un morceau d'un projet open source (spec 021 US7, research R16) : la licence (règles fixes) est montrée avant
 * toute copie ; une licence qui permet la copie donne un fichier avec en-tête d'attribution, sinon seulement une note
 * d'étude ; l'écriture se fait dans `snippets/` ou `techno/` du workspace ProjectMaster, jamais par-dessus un fichier,
 * jamais commitée ni exécutée.
 */
export class ExtractService {
  constructor(private readonly deps: ExtractDeps) {}

  private workspace(): string {
    const root = this.deps.projectsRoot()
    if (root === null || HubRegistry.locate(root) === null) {
      throw new AppError(
        'NO_WORKSPACE',
        'Aucun workspace ProjectMaster : choisis le dossier des projets dans les réglages.'
      )
    }
    return dirname(root)
  }

  /** Texte du fichier du dépôt : sous sa racine réelle, ni sensible, ni binaire, 200 Ko au plus. */
  private source(dir: string, path: string): string {
    if (classifyFile(path, 0, () => false).kind === 'sensitive') {
      throw new AppError('SENSITIVE_FILE', 'Fichier sensible : jamais extrait.')
    }
    let target: string
    try {
      const root = realpathSync(dir)
      target = realpathSync(join(root, ...path.split('/')))
      if (!inside(root, target) || target === root) throw new Error('hors du dépôt')
    } catch {
      throw new AppError('NOT_FOUND', 'Fichier introuvable dans le dépôt.')
    }
    if (statSync(target).size > EXTRACT_MAX_BYTES) throw new AppError('TOO_LARGE', 'Fichier de plus de 200 Ko.')
    const text = readFileSync(target, 'utf8')
    if (text.includes('\u0000')) throw new AppError('BINARY', 'Fichier binaire : rien à extraire.')
    return text
  }

  /** Licence du dépôt : premier fichier `LICENSE` / `COPYING` à la racine. */
  private licenseText(dir: string): string | null {
    const name = readdirSync(dir).find((entry) => LICENSE_FILE.test(entry))
    if (name === undefined) return null
    const file = join(dir, name)
    return statSync(file).isFile() && statSync(file).size <= EXTRACT_MAX_BYTES ? readFileSync(file, 'utf8') : null
  }

  async preview(
    genesisId: string,
    path: string,
    lines?: { readonly from: number; readonly to: number }
  ): Promise<ExtractPreviewView & { readonly copyText: string | null; readonly noteText: string }> {
    const workspace = this.workspace()
    const repo = await this.deps.access.ready(genesisId)
    const text = this.source(repo.dir, path)
    const all = text.split(/\r?\n/)
    if (lines !== undefined && (lines.from > lines.to || lines.to > all.length)) {
      throw new AppError('VALIDATION', `Lignes hors du fichier (1 à ${all.length}).`)
    }
    const commit = (await this.deps.access.head(repo)) ?? ''
    const saved = this.deps.repository.repo(genesisId)
    const license = detectLicense(this.licenseText(repo.dir))
    const info: ExtractOrigin = {
      origin: saved?.githubRepo ?? saved?.remoteUrl ?? basename(repo.dir),
      path,
      commit,
      lines: lines ?? null,
      license,
      date: this.now().toISOString()
    }
    const studyNoteOnly = license.verdict === 'inconnue' || !canAttribute(path)
    return {
      origin: info.origin,
      commit,
      license: { spdx: license.spdx, verdict: license.verdict, summary: license.summary },
      header: studyNoteOnly ? '' : attributionHeader(path, info),
      destinations: ROOTS.map((root) => ({ root, folders: this.folders(join(workspace, root)) })),
      studyNoteOnly,
      // Le code n'est jamais préparé quand la licence ne permet pas la copie.
      copyText: studyNoteOnly
        ? null
        : `${attributionHeader(path, info)}${(lines === undefined ? all : all.slice(lines.from - 1, lines.to)).join('\n')}\n`,
      noteText: studyNote(info)
    }
  }

  async extract(input: {
    readonly genesisId: string
    readonly path: string
    readonly lines?: { readonly from: number; readonly to: number }
    readonly root: Root
    readonly folder: string
    readonly fileName: string
    readonly mode: 'copy' | 'study_note'
  }): Promise<{ readonly written: string }> {
    const startedAt = this.now().toISOString()
    try {
      const preview = await this.preview(input.genesisId, input.path, input.lines)
      const content = input.mode === 'copy' ? preview.copyText : preview.noteText
      if (content === null) {
        throw new AppError('LICENSE_FORBIDS_COPY', 'Licence inconnue : seule une note d’étude est possible.')
      }
      if (input.mode === 'study_note' && !input.fileName.toLowerCase().endsWith('.md')) {
        throw new AppError('DESTINATION_REFUSED', 'Une note d’étude est un fichier .md.')
      }
      if (input.mode === 'copy' && !canAttribute(input.fileName)) {
        throw new AppError('DESTINATION_REFUSED', 'Extension sans en-tête d’attribution possible.')
      }
      if (
        !FOLDER.test(input.folder) ||
        !/^[A-Za-z0-9._-]{1,100}$/.test(input.fileName) ||
        input.fileName.startsWith('.')
      ) {
        throw new AppError('DESTINATION_REFUSED', 'Dossier ou nom de fichier refusé.')
      }
      const base = join(this.workspace(), input.root)
      if (!existsSync(base))
        throw new AppError('DESTINATION_REFUSED', `Le dossier ${input.root}/ du workspace est absent.`)
      const folder = join(base, input.folder)
      mkdirSync(folder, { recursive: true })
      if (!inside(realpathSync(base), realpathSync(folder))) {
        throw new AppError('DESTINATION_REFUSED', 'Destination hors de snippets/ ou techno/.')
      }
      try {
        writeFileSync(join(folder, input.fileName), content, { encoding: 'utf8', flag: 'wx' })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new AppError('NAME_TAKEN', 'Un fichier de ce nom existe déjà : jamais écrasé.')
        }
        throw error
      }
      this.log(input.genesisId, 'ok', null, startedAt)
      return { written: `${input.root}/${input.folder}/${input.fileName}` }
    } catch (error) {
      this.log(input.genesisId, 'failed', error instanceof AppError ? error.code : 'UNKNOWN', startedAt)
      throw error
    }
  }

  private folders(dir: string): string[] {
    if (!existsSync(dir)) return []
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && FOLDER.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .slice(0, 200)
  }

  private log(genesisId: string, status: 'ok' | 'failed', errorCode: string | null, startedAt: string): void {
    this.deps.repository.logOperation({
      genesisId,
      kind: 'extract',
      status,
      ...(errorCode === null ? {} : { errorCode }),
      startedAt,
      finishedAt: this.now().toISOString()
    })
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date()
  }
}
