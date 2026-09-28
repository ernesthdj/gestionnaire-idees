import { z } from 'zod'
import type { TaskKind } from '../../domain/ai/types'
import type { ContextRepository } from '../../infrastructure/db/repositories/ContextRepository'
import type { ContextExample } from './ports'

const MAX_LEARNED_PER_KIND = 20
const SELECTED_PER_CALL = 3

const Content = z.object({ input: z.string(), output: z.unknown(), reason: z.string().optional() })

export interface LearnedExample {
  readonly polarity: 'positive' | 'negative'
  readonly taskKind: TaskKind
  readonly input: string
  readonly output: unknown
  readonly reason?: string
}

/**
 * Exemples injectés dans le contexte de l'agent (spec 001 FR-017).
 * `record` est le point d'intégration pour les propositions acceptées / refusées (spec 002, analyse C3).
 */
export class ExampleStore {
  constructor(private readonly repository: ContextRepository) {}

  record(example: LearnedExample): void {
    this.repository.insertExample({
      polarity: example.polarity,
      taskKind: example.taskKind,
      contentJson: JSON.stringify({
        input: example.input,
        output: example.output,
        ...(example.reason === undefined ? {} : { reason: example.reason })
      }),
      source: example.polarity === 'positive' ? 'accepted_proposal' : 'rejected_proposal',
      contextVersionId: null
    })
    this.repository.trimLearned(example.taskKind, MAX_LEARNED_PER_KIND)
  }

  count(taskKind: TaskKind): number {
    return this.repository.learnedCount(taskKind)
  }

  /** Jusqu'à 3 exemples du type demandé, du plus récent au plus ancien. */
  select(taskKind: TaskKind, activeVersionId: string | null): ContextExample[] {
    return this.repository.activeExamples(taskKind, activeVersionId, SELECTED_PER_CALL).flatMap((row) => {
      const content = Content.safeParse(JSON.parse(row.contentJson))
      if (!content.success) return []
      return [
        {
          polarity: row.polarity,
          input: content.data.input,
          output: content.data.output,
          ...(content.data.reason === undefined ? {} : { reason: content.data.reason })
        }
      ]
    })
  }
}
