import { randomUUID } from 'node:crypto'
import { DOCUMENT_SIZE_LIMITS } from '@shared/ipc/documents'
import { AppError } from '../../domain/errors'
import { documentFileName } from '../../domain/documents/fileName'
import type { ChangeEntry } from '../../infrastructure/db/repositories/changeLog'
import type {
  DocumentAuthor,
  DocumentRepository,
  DocumentRow
} from '../../infrastructure/db/repositories/DocumentRepository'
import type { PlanRepository } from '../../infrastructure/db/repositories/PlanRepository'
import type { DocumentFiles, DocumentFolderRef } from '../../infrastructure/documents/DocumentFiles'
import type { EntityHandler } from '../history/HistoryService'

/** Taille d'un nœud document à sa création (spec 012 D3). */
export const DOCUMENT_DEFAULT_SIZE = { width: 360, height: 280 } as const

export interface DocumentDeps {
  readonly repository: Pick<
    DocumentRepository,
    | 'transaction'
    | 'log'
    | 'insert'
    | 'get'
    | 'list'
    | 'setDeleted'
    | 'setOffset'
    | 'setSize'
    | 'setCurrentVersion'
    | 'insertVersion'
    | 'version'
    | 'latestVersion'
  >
  readonly files: Pick<DocumentFiles, 'folder' | 'takenNames' | 'write' | 'read' | 'trash' | 'pathOf'>
  /** Genesis ou étape vivants : rattachement possible d'un document. */
  readonly nodes: Pick<PlanRepository, 'node'>
  /** Dossier de projet lié au genesis ; `null` : documents dans le profil. */
  readonly projectDir: (genesisId: string) => string | null
  readonly now?: () => Date
}

/**
 * Documents Markdown des neurones (spec 012) : un vrai fichier dans un dossier choisi par l'app, et ses versions en
 * base. Chaque écriture de l'app est un lot d'Historique annulable ; le fichier reste la source de vérité.
 */
export class DocumentService {
  constructor(private readonly deps: DocumentDeps) {}

  create(input: {
    readonly neuronId: string
    readonly title: string
    readonly content: string
    readonly author: 'user' | 'claude'
  }): { readonly document: DocumentRow; readonly batchId: string } {
    const { repository, files } = this.deps
    const node = this.deps.nodes.node(input.neuronId)
    if (node === undefined) throw new AppError('NOT_FOUND', 'Neurone introuvable')
    const projectDir = this.deps.projectDir(node.genesisId)
    const ref: DocumentFolderRef = projectDir === null ? { kind: 'profile' } : { kind: 'project', projectDir }
    const dir = files.folder(ref)
    const title = input.title.trim()
    const document = {
      id: randomUUID(),
      neuronId: node.id,
      genesisId: node.genesisId,
      title,
      folder: ref.kind,
      fileName: documentFileName(title, files.takenNames(dir)),
      ...DOCUMENT_DEFAULT_SIZE,
      origin: input.author
    }
    const batchId = randomUUID()
    repository.transaction(() => {
      repository.insert(document)
      this.recordVersion(document.id, input.content, files.write(dir, document.fileName, input.content), input.author)
      // Écrit en dernier : un échec du fichier annule aussi la base.
      repository.log(batchId, [this.entry(input.author, 'document', document.id, null, { title })], input.author)
    })
    return { document: this.require(document.id), batchId }
  }

  /** Réécrit (`remplacer`) ou complète (`ajouter`) un document : nouvelle version, annulable. */
  write(input: {
    readonly documentId: string
    readonly content: string
    readonly mode: 'remplacer' | 'ajouter'
    readonly author: 'user' | 'claude'
  }): { readonly batchId: string } {
    const document = this.require(input.documentId)
    const before = this.read(document.id)
    const content = input.mode === 'ajouter' ? `${before.content.trimEnd()}\n\n${input.content}` : input.content
    const previous = this.require(document.id).currentVersionId
    const batchId = randomUUID()
    const { repository } = this.deps
    repository.transaction(() => {
      const hash = this.deps.files.write(this.dirOf(document), document.fileName, content)
      const versionId = this.recordVersion(document.id, content, hash, input.author)
      repository.log(
        batchId,
        [
          this.entry(
            input.author,
            'document_version',
            document.id,
            { versionId: previous, title: document.title },
            { versionId, title: document.title }
          )
        ],
        input.author
      )
    })
    return { batchId }
  }

  /**
   * Contenu actuel du fichier. Modifié hors de l'app : une version `externe` est enregistrée (sans lot d'Historique).
   * Disparu : la dernière version connue, avec `missing`.
   */
  read(documentId: string): { readonly content: string; readonly hash: string; readonly missing: boolean } {
    const document = this.require(documentId)
    const file = this.deps.files.read(this.dirOf(document), document.fileName)
    const current =
      document.currentVersionId === null ? undefined : this.deps.repository.version(document.currentVersionId)
    if (file === null) {
      const last = current ?? this.deps.repository.latestVersion(document.id)
      return { content: last?.content ?? '', hash: last?.hash ?? '', missing: true }
    }
    if (current?.hash !== file.hash) this.recordVersion(document.id, file.content, file.hash, 'externe')
    return { ...file, missing: false }
  }

  /** Réécrit le fichier disparu depuis la dernière version connue. */
  recreate(documentId: string): void {
    const document = this.require(documentId)
    const last = this.deps.repository.latestVersion(document.id)
    this.deps.files.write(this.dirOf(document), document.fileName, last?.content ?? '')
  }

  /** Place glissée par mentalyas, relative à sa place d'annexe (non historisée, comme la place d'une idée). */
  move(documentId: string, x: number, y: number): void {
    this.require(documentId)
    this.deps.repository.setOffset(documentId, x, y)
  }

  /** Taille du cadre, dans ses bornes (spec 012 D3). */
  resize(documentId: string, width: number, height: number): void {
    this.require(documentId)
    const limits = DOCUMENT_SIZE_LIMITS
    const fits =
      width >= limits.minWidth && width <= limits.maxWidth && height >= limits.minHeight && height <= limits.maxHeight
    if (!fits) throw new AppError('VALIDATION', 'Taille hors des bornes d’un document')
    this.deps.repository.setSize(documentId, width, height)
  }

  /** Chemin complet du fichier (pour le montrer dans l'Explorateur), résolu par l'app. */
  pathOf(documentId: string): string {
    const document = this.require(documentId)
    return this.deps.files.pathOf(this.dirOf(document), document.fileName)
  }

  /** Retire le nœud de la carte ; le fichier reste en place. Annulable. */
  remove(documentId: string): { readonly batchId: string } {
    const document = this.require(documentId)
    if (document.deletedAt !== null) throw new AppError('NOT_FOUND', 'Document introuvable')
    const batchId = randomUUID()
    const { repository } = this.deps
    repository.transaction(() => {
      repository.setDeleted(document.id, this.now())
      repository.log(
        batchId,
        [
          this.entry(
            'user',
            'document_placement',
            document.id,
            { visible: true, title: document.title },
            { visible: false, title: document.title }
          )
        ],
        'user'
      )
    })
    return { batchId }
  }

  /** Restauration des documents par l'Historique : la base ET le fichier. */
  historyHandlers(): Readonly<Record<string, EntityHandler>> {
    const { repository, files } = this.deps
    return {
      document: {
        snapshot: (id) => {
          const document = repository.get(id)
          return document === undefined || document.deletedAt !== null ? null : { title: document.title }
        },
        apply: (id, target) => {
          const document = repository.get(id)
          if (document === undefined) return
          if (target === null) {
            // Création annulée : le nœud part, le fichier va à la corbeille (jamais effacé).
            repository.setDeleted(id, this.now())
            files.trash(this.dirOf(document), document.fileName)
            return
          }
          repository.setDeleted(id, null)
          const dir = this.dirOf(document)
          if (files.read(dir, document.fileName) === null) {
            files.write(dir, document.fileName, repository.latestVersion(id)?.content ?? '')
          }
        }
      },
      document_version: {
        snapshot: (id) => {
          const document = repository.get(id)
          return document === undefined ? null : { versionId: document.currentVersionId }
        },
        apply: (id, target) => {
          const document = repository.get(id)
          const versionId = target?.['versionId']
          if (document === undefined || typeof versionId !== 'string') return
          const version = repository.version(versionId)
          if (version === undefined) return
          files.write(this.dirOf(document), document.fileName, version.content)
          repository.setCurrentVersion(id, version.id)
        }
      },
      document_placement: {
        snapshot: (id) => {
          const document = repository.get(id)
          return document === undefined ? null : { visible: document.deletedAt === null }
        },
        apply: (id, target) => {
          if (target === null) return
          repository.setDeleted(id, target['visible'] === true ? null : this.now())
        }
      }
    }
  }

  private dirOf(document: DocumentRow): string {
    if (document.folder === 'profile') return this.deps.files.folder({ kind: 'profile' })
    const projectDir = this.deps.projectDir(document.genesisId)
    if (projectDir === null) {
      throw new AppError('FOLDER_MISSING', 'Ce document vit dans un dossier de projet qui n’est plus lié au genesis.')
    }
    return this.deps.files.folder({ kind: 'project', projectDir })
  }

  private recordVersion(documentId: string, content: string, hash: string, author: DocumentAuthor): string {
    const id = randomUUID()
    this.deps.repository.insertVersion({ id, documentId, content, hash, author })
    this.deps.repository.setCurrentVersion(documentId, id)
    return id
  }

  private entry(
    author: 'user' | 'claude',
    entity: string,
    entityId: string,
    before: unknown,
    after: unknown
  ): ChangeEntry {
    return { kind: author === 'claude' ? 'mcp_write' : 'document', entity, entityId, before, after }
  }

  private require(id: string): DocumentRow {
    const document = this.deps.repository.get(id)
    if (document === undefined) throw new AppError('NOT_FOUND', 'Document introuvable')
    return document
  }

  private now(): string {
    return (this.deps.now?.() ?? new Date()).toISOString()
  }
}
