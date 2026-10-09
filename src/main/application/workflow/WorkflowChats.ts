import { randomUUID } from 'node:crypto'
import { AppError } from '../../domain/errors'
import type { WorkflowChatRepository } from '../../infrastructure/db/repositories/WorkflowChatRepository'

export interface WorkflowChatsDeps {
  readonly repository: Pick<WorkflowChatRepository, 'chatOf' | 'insert'>
  /** Genesis lié à un dossier de projet (vivant) ; sinon pas de conversation de nœud. */
  readonly linkedGenesis: (genesisId: string) => boolean
  readonly newId?: () => string
}

/**
 * Conversation propre à un nœud de la vue Workflow (spec 023 D6, 2026-10-09) : créée au premier « Discuter », reprise
 * ensuite (même clé de nœud) ; elle travaille dans le dossier du projet et suit sa confidentialité.
 */
export class WorkflowChats {
  constructor(private readonly deps: WorkflowChatsDeps) {}

  open(genesisId: string, key: string, title: string): { readonly neuronId: string } {
    if (!this.deps.linkedGenesis(genesisId)) throw new AppError('NOT_FOUND', 'Projet introuvable.')
    const existing = this.deps.repository.chatOf(genesisId, key)
    if (existing !== undefined) return { neuronId: existing }
    const neuronId = (this.deps.newId ?? randomUUID)()
    this.deps.repository.insert({ id: neuronId, genesisId, key, title })
    return { neuronId }
  }
}
