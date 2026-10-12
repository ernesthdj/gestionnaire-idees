import { randomUUID } from 'node:crypto'
import { FOLDER_OFFSET_MAX, FOLDER_PREVIEW_MAX, folderFileKind } from '@shared/ipc/folders'
import type { FolderAnchor, FolderBadge, FolderFileView } from '@shared/ipc/folders'
import type { ElementFileView } from '@shared/ipc/reprise'
import { AppError } from '../../domain/errors'
import { checkProjectPath } from '../../domain/finals/projectPath'
import { FOLDER_FILE_MAX, isUnseen, mergeFolderFiles, pathKey, sortFolderFiles } from '../../domain/folders/folderRules'
import { langOf } from '../../domain/reprise/fileFilter'
import type { DocumentRepository } from '../../infrastructure/db/repositories/DocumentRepository'
import type {
  FolderEntryRow,
  FolderEntrySource,
  FolderRepository
} from '../../infrastructure/db/repositories/FolderRepository'
import type { ProjectFiles } from '../../infrastructure/finals/ProjectFiles'
import { documentView } from '../documents/documentView'
import type { EntityHandler } from '../history/HistoryService'
import { fileLabel } from '../mcp/DocumentTools'

/** Conversation d'un nœud Workflow (spec 023 D6) : son dossier se pose à côté du nœud de même clé. */
export interface WorkflowChatRef {
  readonly id: string
  readonly genesisId: string
  readonly key: string
}

export interface FolderDeps {
  readonly repository: Pick<
    FolderRepository,
    | 'places'
    | 'move'
    | 'markSeen'
    | 'liveEntries'
    | 'entryOf'
    | 'entry'
    | 'insertEntry'
    | 'updateEntry'
    | 'transaction'
    | 'log'
  >
  readonly documents: Pick<DocumentRepository, 'list' | 'claudeWrites'>
  readonly workflowChats?: () => readonly WorkflowChatRef[]
  /** Dossier du projet lié au genesis du nœud ; `null` : aucun (rien d'autre qu'un document n'y est rangé). */
  readonly projectDirOf?: (neuronId: string) => string | null
  /** Garde des chemins du projet (`realpath` sous le projet, liens refusés) et lecture texte bornée. */
  readonly files?: Pick<ProjectFiles, 'resolve' | 'read'>
  readonly exists?: (absolutePath: string) => boolean
  /** Le dossier d'un nœud a changé : la carte se rafraîchit. */
  readonly changed?: (neuronId: string) => void
  readonly now?: () => Date
}

const ENTITY = 'folder_entry'

/**
 * Dossier d'un nœud (spec 028) : ce qu'il contient, calculé à la lecture — documents du nœud (spec 012) non épinglés,
 * fichiers du projet couverts par les chemins d'un élément (moins ceux masqués), fichiers rangés (écrits par Claude dans
 * la conversation du nœud, ajoutés à la main) — et sa place sur la carte. Pas de dossier vide (D1). Le dossier range,
 * il ne gère pas : rien n'est copié, déplacé ni effacé sur le disque ; tout rangement est annulable.
 */
export class FolderService {
  constructor(private readonly deps: FolderDeps) {}

  /**
   * Dossiers des nœuds dessinés : `onMap` porte les genesis, étapes et éléments présents sur la carte ; `covered`, les
   * fichiers du projet (chemins relatifs, sans fichier sensible) que couvrent les chemins de chaque élément.
   */
  badges(onMap: ReadonlySet<string>, covered: ReadonlyMap<string, readonly string[]> = new Map()): FolderBadge[] {
    const places = this.deps.repository.places()
    const workflow = new Map(
      (this.deps.workflowChats?.() ?? [])
        .filter((chat) => onMap.has(chat.genesisId))
        .map((chat) => [chat.id, chat] as const)
    )
    const shown = (neuronId: string): boolean => onMap.has(neuronId) || workflow.has(neuronId)
    const seenOf = (neuronId: string): string | null => places.get(neuronId)?.seenAt ?? null
    const files = new Map<string, FolderFileView[]>()
    const add = (neuronId: string, file: FolderFileView): void => {
      files.set(neuronId, [...(files.get(neuronId) ?? []), file])
    }
    const claude = this.deps.documents.claudeWrites()
    for (const document of this.deps.documents.list()) {
      if (document.pinned || !shown(document.neuronId)) continue
      const path = fileLabel(document)
      const writtenByClaude = claude.get(document.id) ?? null
      add(document.neuronId, {
        path,
        name: document.fileName,
        kind: folderFileKind(path),
        source: 'document',
        updatedAt: writtenByClaude ?? document.createdAt,
        unseen: isUnseen(writtenByClaude, seenOf(document.neuronId)),
        document: documentView(document)
      })
    }
    const hidden = new Set<string>()
    for (const entry of this.deps.repository.liveEntries()) {
      if (entry.hidden) {
        hidden.add(`${entry.neuronId}|${entry.pathKey}`)
        continue
      }
      if (entry.source === 'covered' || !shown(entry.neuronId)) continue
      add(entry.neuronId, {
        ...this.fileView(entry.path, entry.source, entry.updatedAt),
        unseen: isUnseen(entry.addedBy === 'claude' ? entry.updatedAt : null, seenOf(entry.neuronId))
      })
    }
    for (const [elementId, paths] of covered) {
      if (!onMap.has(elementId)) continue
      for (const path of paths) {
        if (!hidden.has(`${elementId}|${pathKey(path)}`)) add(elementId, this.fileView(path, 'covered', ''))
      }
    }
    return [...files].map(([neuronId, list]): FolderBadge => {
      const sorted = sortFolderFiles(mergeFolderFiles(list)).slice(0, FOLDER_FILE_MAX)
      const place = places.get(neuronId)
      const chat = workflow.get(neuronId)
      const anchor: FolderAnchor =
        chat === undefined
          ? { kind: 'neuron', id: neuronId }
          : { kind: 'workflow', key: chat.key, genesisId: chat.genesisId }
      return {
        neuronId,
        anchor,
        count: sorted.length,
        unseen: sorted.some((file) => file.unseen),
        preview: sorted.slice(0, FOLDER_PREVIEW_MAX),
        offset: { x: place?.offsetX ?? 0, y: place?.offsetY ?? 0 },
        moved: place?.moved ?? false
      }
    })
  }

  /** Place glissée, relative à la place par défaut (bornée comme celle d'un document). */
  move(neuronId: string, x: number, y: number): void {
    if (Math.abs(x) > FOLDER_OFFSET_MAX || Math.abs(y) > FOLDER_OFFSET_MAX) {
      throw new AppError('VALIDATION', 'Place hors des bornes de la carte')
    }
    this.deps.repository.move(neuronId, x, y)
  }

  /** Dossier ouvert par mentalyas : ce que Claude y a mis n'est plus « nouveau ». */
  markSeen(neuronId: string): void {
    this.deps.repository.markSeen(neuronId, this.now())
  }

  /**
   * Fichier écrit avec succès par Claude dans la conversation du nœud (spec 028 D2 c) : rangé dans son dossier, ou mis
   * à jour s'il y est déjà — il redevient « nouveau ». Chemin déjà contrôlé par le suivi des écritures ; revérifié ici.
   */
  record(neuronId: string, relativePath: string): void {
    const check = checkProjectPath(relativePath)
    if (!check.ok || this.deps.projectDirOf?.(neuronId) == null) return
    const existing = this.deps.repository.entryOf(neuronId, check.key)
    if (existing !== undefined && existing.deletedAt === null && !existing.hidden) {
      this.deps.repository.updateEntry(existing.id, { updatedAt: this.now(), addedBy: 'claude' })
    } else {
      if (existing === undefined && this.count(neuronId) >= FOLDER_FILE_MAX) return
      this.place(neuronId, check.path, existing, 'conversation', 'claude')
    }
    this.deps.changed?.(neuronId)
  }

  /** Fichier du projet ajouté à la main (« + », spec 028 D2 d) ; `null` : déjà dans ce dossier. */
  add(neuronId: string, path: string): { readonly batchId: string | null } {
    const projectDir = this.deps.projectDirOf?.(neuronId)
    if (projectDir === undefined || projectDir === null) {
      throw new AppError(
        'NO_PROJECT',
        'Seuls les fichiers du projet peuvent être rangés : ce nœud n’a pas de projet lié.'
      )
    }
    const check = checkProjectPath(path)
    if (!check.ok)
      throw new AppError('VALIDATION', `Seuls les fichiers du projet peuvent être rangés : ${check.reason}.`)
    const absolute = this.files().resolve(projectDir, check.path)
    if (!(this.deps.exists ?? (() => true))(absolute)) throw new AppError('NOT_FOUND', 'Ce fichier est introuvable.')
    const existing = this.deps.repository.entryOf(neuronId, check.key)
    if (existing !== undefined && existing.deletedAt === null && !existing.hidden) return { batchId: null }
    if (this.count(neuronId) >= FOLDER_FILE_MAX) {
      throw new AppError('VALIDATION', `Un dossier range ${FOLDER_FILE_MAX} fichiers au plus.`)
    }
    const batchId = this.place(neuronId, check.path, existing, 'manual', 'user')
    this.deps.changed?.(neuronId)
    return { batchId }
  }

  /** Retire un fichier rangé du dossier (jamais du disque) ; annulable. */
  remove(neuronId: string, path: string): { readonly batchId: string } {
    const entry = this.liveEntry(neuronId, path)
    if (entry === undefined || entry.hidden || entry.source === 'covered') {
      throw new AppError('NOT_IN_FOLDER', 'Ce fichier n’est pas rangé dans ce dossier.')
    }
    const batchId = this.change(entry, { deletedAt: this.now() }, 'user')
    this.deps.changed?.(neuronId)
    return { batchId }
  }

  /** Fichier couvert par l'élément : « Ne plus afficher dans le dossier » (ses chemins ne changent pas) ; annulable. */
  hide(neuronId: string, path: string): { readonly batchId: string } {
    const check = checkProjectPath(path)
    if (!check.ok) throw new AppError('VALIDATION', check.reason)
    const existing = this.deps.repository.entryOf(neuronId, check.key)
    const batchId =
      existing === undefined
        ? this.place(neuronId, check.path, undefined, 'covered', 'user', true)
        : this.change(existing, { hidden: true, deletedAt: null }, 'user')
    this.deps.changed?.(neuronId)
    return { batchId }
  }

  /** Le fichier couvert masqué revient dans le dossier ; annulable. */
  unhide(neuronId: string, path: string): { readonly batchId: string } {
    const entry = this.liveEntry(neuronId, path)
    if (entry === undefined || !entry.hidden) throw new AppError('NOT_IN_FOLDER', 'Ce fichier n’est pas masqué.')
    const batchId = this.change(
      entry,
      { hidden: false, ...(entry.source === 'covered' ? { deletedAt: this.now() } : {}) },
      'user'
    )
    this.deps.changed?.(neuronId)
    return { batchId }
  }

  /** Contenu d'un fichier rangé (écrit en conversation ou ajouté), pour le lecteur ; jamais un fichier hors du dossier. */
  file(neuronId: string, path: string): ElementFileView {
    const entry = this.liveEntry(neuronId, path)
    const projectDir = this.deps.projectDirOf?.(neuronId)
    if (entry === undefined || entry.hidden || entry.source === 'covered' || projectDir == null) {
      throw new AppError('NOT_IN_FOLDER', 'Ce fichier n’est pas rangé dans ce dossier.')
    }
    const read = this.files().read(projectDir, entry.path)
    if (read === null) throw new AppError('NOT_FOUND', 'Le fichier est introuvable dans le dossier du projet.')
    return { path: entry.path, lang: langOf(entry.path), lines: read.content.split(/\r?\n/), symbols: [] }
  }

  /** Annulation par l'Historique : une ligne retirée revient, une ligne créée part, un masque se défait. */
  historyHandlers(): Readonly<Record<string, EntityHandler>> {
    const { repository } = this.deps
    return {
      [ENTITY]: {
        snapshot: (id) => {
          const entry = repository.entry(id)
          return entry === undefined || entry.deletedAt !== null
            ? null
            : { name: nameOf(entry.path), hidden: entry.hidden }
        },
        apply: (id, target) => {
          const entry = repository.entry(id)
          if (entry === undefined) return
          repository.updateEntry(
            id,
            target === null ? { deletedAt: this.now() } : { deletedAt: null, hidden: target['hidden'] === true }
          )
          this.deps.changed?.(entry.neuronId)
        }
      }
    }
  }

  private fileView(path: string, source: FolderEntrySource, updatedAt: string): FolderFileView {
    return { path, name: nameOf(path), kind: folderFileKind(path), source, updatedAt, unseen: false }
  }

  private liveEntry(neuronId: string, path: string): FolderEntryRow | undefined {
    const entry = this.deps.repository.entryOf(neuronId, pathKey(path))
    return entry?.deletedAt === null ? entry : undefined
  }

  private count(neuronId: string): number {
    return this.deps.repository.liveEntries().filter((entry) => entry.neuronId === neuronId).length
  }

  /** Range (ou fait revenir) une ligne, dans un lot d'Historique. */
  private place(
    neuronId: string,
    path: string,
    existing: FolderEntryRow | undefined,
    source: FolderEntrySource,
    by: 'user' | 'claude',
    hidden = false
  ): string {
    const { repository } = this.deps
    const batchId = randomUUID()
    repository.transaction(() => {
      const before =
        existing === undefined || existing.deletedAt !== null
          ? null
          : { name: nameOf(existing.path), hidden: existing.hidden }
      const id =
        existing === undefined
          ? repository.insertEntry({
              neuronId,
              path,
              pathKey: pathKey(path),
              source,
              hidden,
              addedBy: by,
              updatedAt: this.now()
            }).id
          : existing.id
      if (existing !== undefined) {
        repository.updateEntry(id, { source, hidden, addedBy: by, updatedAt: this.now(), deletedAt: null })
      }
      repository.log(
        batchId,
        [{ kind: 'folder', entity: ENTITY, entityId: id, before, after: { name: nameOf(path), hidden } }],
        by
      )
    })
    return batchId
  }

  private change(
    entry: FolderEntryRow,
    patch: Partial<Pick<FolderEntryRow, 'hidden' | 'deletedAt'>>,
    by: 'user' | 'claude'
  ): string {
    const { repository } = this.deps
    const batchId = randomUUID()
    repository.transaction(() => {
      repository.updateEntry(entry.id, patch)
      const after = repository.entry(entry.id)
      repository.log(
        batchId,
        [
          {
            kind: 'folder',
            entity: ENTITY,
            entityId: entry.id,
            before: entry.deletedAt !== null ? null : { name: nameOf(entry.path), hidden: entry.hidden },
            after:
              after === undefined || after.deletedAt !== null
                ? null
                : { name: nameOf(after.path), hidden: after.hidden }
          }
        ],
        by
      )
    })
    return batchId
  }

  private files(): Pick<ProjectFiles, 'resolve' | 'read'> {
    if (this.deps.files === undefined) throw new AppError('NO_PROJECT', 'Lecture des fichiers du projet indisponible.')
    return this.deps.files
  }

  private now(): string {
    return (this.deps.now?.() ?? new Date()).toISOString()
  }
}

const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1)
