import { and, eq } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { neurons } from '../schemaNeurons'

/**
 * Conversations des nœuds de la vue Workflow (spec 023 D6) : un neurone caché par nœud, rattaché à son genesis (dont
 * il prend le dossier et la confidentialité), retrouvé par la clé du nœud.
 */
export class WorkflowChatRepository {
  constructor(private readonly db: AppDatabase) {}

  chatOf(genesisId: string, key: string): string | undefined {
    return this.db
      .select({ id: neurons.id })
      .from(neurons)
      .where(and(eq(neurons.kind, 'workflow_chat'), eq(neurons.genesisId, genesisId), eq(neurons.elementKey, key)))
      .get()?.id
  }

  insert(input: {
    readonly id: string
    readonly genesisId: string
    readonly key: string
    readonly title: string
  }): void {
    this.db
      .insert(neurons)
      .values({
        id: input.id,
        rootId: input.id,
        kind: 'workflow_chat',
        title: input.title,
        origin: 'user',
        hidden: true,
        genesisId: input.genesisId,
        elementKey: input.key
      })
      .run()
  }
}
