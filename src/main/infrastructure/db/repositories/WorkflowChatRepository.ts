import { and, eq, isNull } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { neurons } from '../schemaNeurons'

export type HiddenChatKind = 'workflow_chat' | 'agent_chat'

/**
 * Conversations des nœuds de la vue Workflow (spec 023 D6) : un neurone caché par nœud, rattaché à son genesis (dont
 * il prend le dossier et la confidentialité), retrouvé par la clé du nœud.
 */
export class WorkflowChatRepository {
  constructor(private readonly db: AppDatabase) {}

  /** Conversation d'un nœud Workflow, ou d'un agent (`agent_chat`, L1o D13), retrouvée par sa clé. */
  chatOf(genesisId: string, key: string, kind: HiddenChatKind = 'workflow_chat'): string | undefined {
    return this.db
      .select({ id: neurons.id })
      .from(neurons)
      .where(and(eq(neurons.kind, kind), eq(neurons.genesisId, genesisId), eq(neurons.elementKey, key)))
      .get()?.id
  }

  /** Conversation en tête-à-tête avec un agent, hors de toute tâche (L1o D22) : sans genesis, retrouvée par sa clé. */
  profileChatOf(key: string): string | undefined {
    return this.db
      .select({ id: neurons.id })
      .from(neurons)
      .where(and(eq(neurons.kind, 'agent_chat'), isNull(neurons.genesisId), eq(neurons.elementKey, key)))
      .get()?.id
  }

  /** Clés des conversations cachées d'un projet (nœuds du Workflow et agents). */
  keysOf(genesisId: string): Set<string> {
    return new Set(
      this.db
        .select({ key: neurons.elementKey })
        .from(neurons)
        .where(eq(neurons.genesisId, genesisId))
        .all()
        .flatMap((row) => (row.key === null ? [] : [row.key]))
    )
  }

  /**
   * Le nœud a changé de clé (spec 032 D21, L1o D27) : sa conversation, et celles des agents qui y étaient connectés
   * (`agent:<agent>:<nœud>`), le suivent. Une conversation déjà posée sur la nouvelle clé n'est jamais écrasée.
   */
  moveHost(genesisId: string, from: string, to: string): number {
    const rows = this.db
      .select({ id: neurons.id, key: neurons.elementKey, kind: neurons.kind })
      .from(neurons)
      .where(eq(neurons.genesisId, genesisId))
      .all()
    const taken = new Set(rows.map((row) => row.key))
    let moved = 0
    for (const row of rows) {
      if (row.key === null || (row.kind !== 'workflow_chat' && row.kind !== 'agent_chat')) continue
      const next =
        row.kind === 'workflow_chat'
          ? row.key === from
            ? to
            : null
          : row.key.startsWith('agent:') && row.key.endsWith(`:${from}`)
            ? `${row.key.slice(0, row.key.length - from.length)}${to}`
            : null
      if (next === null || taken.has(next)) continue
      this.db.update(neurons).set({ elementKey: next }).where(eq(neurons.id, row.id)).run()
      taken.add(next)
      moved += 1
    }
    return moved
  }

  /** Toutes les conversations de nœuds Workflow : où poser le dossier de chacune sur la carte (spec 028). */
  chats(): { readonly id: string; readonly genesisId: string; readonly key: string }[] {
    return this.db
      .select({ id: neurons.id, genesisId: neurons.genesisId, key: neurons.elementKey })
      .from(neurons)
      .where(eq(neurons.kind, 'workflow_chat'))
      .all()
      .flatMap((row) =>
        row.genesisId === null || row.key === null ? [] : [{ id: row.id, genesisId: row.genesisId, key: row.key }]
      )
  }

  insert(input: {
    readonly id: string
    /** `null` : conversation d'un agent hors de toute tâche (L1o D22). */
    readonly genesisId: string | null
    readonly key: string
    readonly title: string
    readonly kind?: HiddenChatKind
  }): void {
    this.db
      .insert(neurons)
      .values({
        id: input.id,
        rootId: input.id,
        kind: input.kind ?? 'workflow_chat',
        title: input.title,
        origin: 'user',
        hidden: true,
        genesisId: input.genesisId,
        elementKey: input.key
      })
      .run()
  }
}
