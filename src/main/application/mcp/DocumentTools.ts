import type { ToolResult } from '@shared/mcp/protocol'
import type { DocumentEcrireInput } from '@shared/mcp/tools'
import type { McpCaller } from '../../domain/mcp/caller'
import { McpToolError } from '../../domain/mcp/errors'
import type { ConversationRepository } from '../../infrastructure/db/repositories/ConversationRepository'
import type { DocumentRepository, DocumentRow } from '../../infrastructure/db/repositories/DocumentRepository'
import type { DocumentService } from '../documents/DocumentService'
import { conversationTarget } from './target'

export interface DocumentToolsDeps {
  readonly documents: Pick<DocumentService, 'create' | 'write' | 'read'>
  readonly repository: Pick<DocumentRepository, 'get'>
  readonly conversations: Pick<ConversationRepository, 'neuron'>
  /** Écriture faite : la carte se rafraîchit et la notification propose « Annuler ». */
  readonly onWritten: (event: { readonly batchId: string; readonly summary: string; readonly count: number }) => void
  /** Dossiers des nœuds actifs (spec 028) : tout nœud de la carte reçoit des documents. Défaut : `FOLDERS_ENABLED`. */
  readonly allNodes?: boolean
}

/** Emplacement lisible d'un document (jamais le chemin complet). */
export function fileLabel(document: Pick<DocumentRow, 'folder' | 'fileName'>): string {
  return `${document.folder === 'project' ? 'docs/brainstormer' : 'documents'}/${document.fileName}`
}

/**
 * Outils des documents (spec 012) : Claude crée, réécrit ou complète le document d'un neurone de son arbre, et le
 * relit. Écritures « par Claude », annulables ; le chemin du fichier est toujours choisi par l'app.
 */
/** Sortes de neurones qui ont un dossier sur la carte (spec 028 D1). */
const DOCUMENT_HOLDERS: ReadonlySet<string> = new Set(['root', 'step', 'element', 'workflow_chat'])
/** Sans les dossiers : un genesis et les étapes de son plan (spec 012). */
const PLAN_HOLDERS: ReadonlySet<string> = new Set(['root', 'step'])

export class DocumentTools {
  constructor(private readonly deps: DocumentToolsDeps) {}

  write(input: DocumentEcrireInput, caller: McpCaller): ToolResult {
    if (input.document !== undefined) {
      const document = this.documentOf(input.document, caller)
      const { batchId } = this.deps.documents.write({
        documentId: document.id,
        content: input.contenu,
        mode: input.mode ?? 'remplacer',
        author: 'claude'
      })
      const summary = `Claude : document « ${document.title} » ${input.mode === 'ajouter' ? 'complété' : 'réécrit'}`
      this.deps.onWritten({ batchId, summary, count: 1 })
      return { text: `${summary} (${fileLabel(document)}) — annulable par mentalyas.`, data: { document: document.id } }
    }
    const neuron = conversationTarget(this.deps.conversations, input.id, caller, true)
    // Avec les dossiers (spec 028 D1), tout nœud de la carte porte ses documents ; sinon un genesis et ses étapes
    // (spec 012), refus explicite et marche à suivre pour un élément de carte de structure.
    if (this.deps.allNodes !== true && neuron.kind === 'element') {
      throw new McpToolError(
        'NON_MODIFIABLE',
        'Un élément de carte de structure n’a pas de document relié : écris le fichier .md directement dans le projet, ' +
          'sous un chemin de l’élément ; il rejoint ses fichiers.'
      )
    }
    if (!(this.deps.allNodes === true ? DOCUMENT_HOLDERS : PLAN_HOLDERS).has(neuron.kind)) {
      throw new McpToolError(
        'NON_MODIFIABLE',
        this.deps.allNodes === true
          ? 'Seuls les nœuds de la carte (genesis, étape, élément, nœud Workflow) ont des documents.'
          : 'Seuls un genesis et les étapes de son plan ont des documents reliés.'
      )
    }
    const { document, batchId } = this.deps.documents.create({
      neuronId: neuron.id,
      title: input.titre,
      content: input.contenu,
      author: 'claude'
    })
    const summary = `Claude : document « ${document.title} » pour « ${neuron.title} »`
    this.deps.onWritten({ batchId, summary, count: 1 })
    return { text: `${summary} (${fileLabel(document)}) — annulable par mentalyas.`, data: { document: document.id } }
  }

  read(documentId: string, caller: McpCaller): ToolResult {
    const document = this.documentOf(documentId, caller)
    const { content, missing } = this.deps.documents.read(document.id)
    const header = `Document « ${document.title} » (${fileLabel(document)})${missing ? ' — fichier introuvable, dernière version connue' : ''}`
    return { text: `${header}\n\n${content}` }
  }

  /** Document vivant de l'arbre de la conversation. */
  private documentOf(documentId: string, caller: McpCaller): DocumentRow {
    const document = this.deps.repository.get(documentId)
    if (document === undefined || document.deletedAt !== null) {
      throw new McpToolError('INTROUVABLE', `Document ${documentId} introuvable (retiré ou annulé ?)`)
    }
    // Le neurone du document doit appartenir à l'arbre de la conversation.
    conversationTarget(this.deps.conversations, document.neuronId, caller)
    return document
  }
}
