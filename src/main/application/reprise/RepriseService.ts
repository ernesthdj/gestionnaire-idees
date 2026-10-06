import { randomUUID } from 'node:crypto'
import { existsSync, realpathSync } from 'node:fs'
import { basename, isAbsolute, relative } from 'node:path'
import type { CodeLang, Confidentiality, ImportPreviewView, RepriseProjectView } from '@shared/ipc/reprise'
import { AppError } from '../../domain/errors'
import type { RepriseRepository } from '../../infrastructure/db/repositories/RepriseRepository'
import type { ProjectScan } from '../../infrastructure/reprise/ProjectScanner'

export interface RepriseDeps {
  readonly repository: Pick<
    RepriseRepository,
    'transaction' | 'createProject' | 'project' | 'projectByRoot' | 'setConfidentiality'
  >
  /** Sélecteur de dossier natif (main) ; `undefined` si annulé. Jamais un chemin venu de l'interface. */
  readonly pickFolder: () => Promise<string | undefined>
  readonly scan: (root: string) => ProjectScan
  /** Neurones liés à un dossier de projet (spec 008, 016, 017). */
  readonly linkedFolders: () => readonly { readonly id: string; readonly projectDir: string }[]
  /** Crée le genesis « projet repris » (titre : nom du dossier). */
  readonly createGenesis: (title: string) => Promise<string>
  /** Lie le genesis à son dossier source. */
  readonly attach: (neuronId: string, dir: string) => void
  /** Dossier de données de l'app : jamais importable (spec 017 FR-006). */
  readonly dataDir: string
  readonly realpath?: (path: string) => string
  readonly exists?: (path: string) => boolean
  readonly now?: () => Date
  readonly newId?: () => string
  /** Projet créé : son analyse démarre (spec 017 US3). */
  readonly onCreated?: (genesisId: string) => void
}

/** Un aperçu attend la décision de mentalyas 15 minutes au plus. */
export const PREVIEW_TTL_MS = 15 * 60_000

interface Preview {
  readonly root: string
  readonly source: 'folder' | 'git'
  readonly remoteUrl: string | null
  readonly view: ImportPreviewView
  readonly expiresAt: number
}

const key = (path: string): string => path.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase()

/** `child` est-il `parent` ou à l'intérieur (chemins réels, casse ignorée comme sous Windows) ? */
function within(parent: string, child: string): boolean {
  const path = relative(key(parent), key(child))
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
}

/**
 * Faire entrer un projet existant dans l'app (spec 017 US1) : aperçu du dossier choisi au sélecteur natif, puis
 * création d'un genesis « projet repris » lié à son dossier source, avec un niveau de confidentialité choisi
 * explicitement. Le chemin reste dans le main : l'interface ne manipule qu'un `previewId` éphémère.
 */
export class RepriseService {
  private readonly previews = new Map<string, Preview>()

  constructor(private readonly deps: RepriseDeps) {}

  /** Dossier choisi au sélecteur natif → aperçu ; `null` si mentalyas annule. */
  async previewFolder(): Promise<ImportPreviewView | null> {
    const picked = await this.deps.pickFolder()
    if (picked === undefined) return null
    return this.preview(picked, 'folder', null)
  }

  /** Aperçu d'un dossier déjà sur le disque (dossier choisi, ou cible d'un clone fini, spec 017 US5). */
  preview(path: string, source: 'folder' | 'git', remoteUrl: string | null): ImportPreviewView {
    this.prune()
    const root = (this.deps.realpath ?? realpathSync)(path)
    const dataDir = (this.deps.realpath ?? realpathSync)(this.deps.dataDir)
    if (within(root, dataDir) || within(dataDir, root)) {
      throw new AppError('FOLDER_REFUSED', 'Ce dossier contient les données de l’app (ou en fait partie) : refusé.')
    }
    const scan = this.deps.scan(root)
    const counts = new Map<CodeLang, number>()
    for (const file of scan.retained) counts.set(file.lang, (counts.get(file.lang) ?? 0) + 1)
    const previewId = this.deps.newId?.() ?? randomUUID()
    const view: ImportPreviewView = {
      previewId,
      name: basename(root),
      languages: [...counts.entries()]
        .filter(([lang]) => lang !== 'other')
        .map(([lang, files]) => ({ lang, files }))
        .sort((a, b) => b.files - a.files),
      files: scan.retained.length,
      ignored: scan.ignored + scan.tooLargeFiles,
      sensitive: scan.sensitive,
      git: scan.git,
      tooLarge: scan.overLimit,
      alreadyLinked: this.linkedTo(root)
    }
    this.previews.set(previewId, { root, source, remoteUrl, view, expiresAt: this.now().getTime() + PREVIEW_TTL_MS })
    return view
  }

  /** Crée le genesis « projet repris » de l'aperçu, avec la confidentialité choisie (sans valeur par défaut). */
  async create(previewId: string, confidentiality: Confidentiality): Promise<{ readonly genesisId: string }> {
    this.prune()
    const preview = this.previews.get(previewId)
    if (preview === undefined) throw new AppError('NOT_FOUND', 'Aperçu expiré : choisis de nouveau le dossier.')
    if (preview.view.tooLarge) {
      throw new AppError('TOO_LARGE', 'Projet trop grand : choisis un sous-dossier.')
    }
    const linked = this.linkedTo(preview.root)
    if (linked !== null) {
      throw new AppError('ALREADY_LINKED', 'Ce dossier est déjà lié à un neurone de la carte.', { neuronId: linked })
    }
    this.previews.delete(previewId)
    const genesisId = await this.deps.createGenesis(preview.view.name)
    this.deps.attach(genesisId, preview.root)
    this.deps.repository.createProject({
      genesisId,
      rootDir: preview.root,
      source: preview.source,
      remoteUrl: preview.remoteUrl,
      confidentiality,
      confidentialityChangedAt: this.now().toISOString()
    })
    this.deps.onCreated?.(genesisId)
    return { genesisId }
  }

  view(genesisId: string): RepriseProjectView {
    const project = this.deps.repository.project(genesisId)
    if (project === undefined) throw new AppError('NOT_FOUND', 'Projet repris introuvable.')
    return {
      genesisId,
      name: basename(project.rootDir),
      source: project.source,
      confidentiality: project.confidentiality,
      remote: project.remoteUrl,
      folderMissing: !(this.deps.exists ?? existsSync)(project.rootDir),
      analysis: { state: project.analysisState, progress: null, stats: null, analyzedAt: project.analyzedAt }
    }
  }

  /**
   * Niveau de confidentialité (spec 017 FR-005) : « Local uniquement » → « Claude autorisé » exige la confirmation ;
   * l'inverse est immédiat (ce qui a déjà été envoyé ne peut pas être rappelé : l'interface le dit).
   */
  setConfidentiality(genesisId: string, level: Confidentiality, confirm = false): { readonly level: Confidentiality } {
    const project = this.deps.repository.project(genesisId)
    if (project === undefined) throw new AppError('NOT_FOUND', 'Projet repris introuvable.')
    if (project.confidentiality === level) return { level }
    if (level === 'claude' && !confirm) {
      throw new AppError(
        'CONFIRM_REQUIRED',
        'Le code, les noms et les chemins de ce projet pourront être envoyés à Claude. Confirme pour l’autoriser.'
      )
    }
    this.deps.repository.setConfidentiality(genesisId, level, this.now().toISOString())
    return { level }
  }

  /** Neurone déjà lié à ce dossier (même chemin réel, casse ignorée) ; `null` : aucun. */
  private linkedTo(root: string): string | null {
    const repris = this.deps.repository.projectByRoot(root)
    if (repris !== undefined) return repris.genesisId
    const realpath = this.deps.realpath ?? realpathSync
    for (const linked of this.deps.linkedFolders()) {
      let real: string
      try {
        real = realpath(linked.projectDir)
      } catch {
        real = linked.projectDir
      }
      if (key(real) === key(root)) return linked.id
    }
    return null
  }

  private prune(): void {
    const now = this.now().getTime()
    for (const [id, preview] of this.previews) if (preview.expiresAt < now) this.previews.delete(id)
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date()
  }
}
