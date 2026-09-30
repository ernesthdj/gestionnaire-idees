import { SummaryOut } from '@shared/ai/schemas'
import type { HatchedResultView, IdeaSummaryView } from '@shared/ipc/neurons'
import { AppError } from '../../domain/errors'
import type { GrowthRepository } from '../../infrastructure/db/repositories/GrowthRepository'
import type { AIGateway } from '../ai/AIGateway'
import { documentText } from './GrowthContextBuilder'

export interface IdeaSummaryDependencies {
  readonly repository: Pick<GrowthRepository, 'summary' | 'saveSummary' | 'nodesWithHistory'>
  readonly gateway: Pick<AIGateway, 'run'>
  /** Document de l'idée si elle a déjà éclos. */
  readonly document: (rootId: string) => HatchedResultView | null
}

/** Borne du texte envoyé à l'IA locale (≈ 1 500 tokens). */
const MAX_INPUT_CHARS = 6_000

/**
 * Résumé d'une idée de départ, affiché dans sa fiche : calculé par l'IA locale à partir de tout ce que le
 * brainstorming a apporté, mémorisé, et recalculé seulement quand l'idée a changé. Sans IA disponible, le dernier
 * résumé connu est renvoyé (signalé périmé) ; le texte d'origine reste toujours affiché par l'interface.
 */
export class IdeaSummaryService {
  private readonly inFlight = new Map<string, Promise<IdeaSummaryView>>()

  constructor(private readonly deps: IdeaSummaryDependencies) {}

  get(rootId: string): Promise<IdeaSummaryView> {
    const running = this.inFlight.get(rootId)
    if (running !== undefined) return running
    const task = this.compute(rootId).finally(() => this.inFlight.delete(rootId))
    this.inFlight.set(rootId, task)
    return task
  }

  private async compute(rootId: string): Promise<IdeaSummaryView> {
    const { repository, gateway } = this.deps
    const root = repository.summary(rootId)
    if (root === undefined) throw new AppError('NOT_FOUND', 'Idée introuvable')
    const nodes = repository.nodesWithHistory(rootId).filter((node) => node.kind !== 'root')
    const document = this.deps.document(rootId)
    // Idée encore brute : il n'y a rien à résumer de plus que son texte d'origine.
    if (nodes.length === 0 && document === null) return { summary: null, stale: false }
    if (root.summary !== null && root.summaryVersion === root.version) return { summary: root.summary, stale: false }

    const brought = nodes.map(
      (node) => `- ${node.title}${node.content !== null && node.content !== node.title ? ` — ${node.content}` : ''}`
    )
    const input = [
      `Idée de départ : ${root.content ?? root.title}`,
      `Nature : ${root.nature === 'action' ? 'Action (à réaliser)' : 'Réflexion (à explorer)'}`,
      brought.length === 0 ? null : `Ce que le brainstorming a apporté :\n${brought.join('\n')}`,
      document === null ? null : `Document de l’idée :\n${documentText(document)}`
    ]
      .filter((part) => part !== null)
      .join('\n\n')
      .slice(0, MAX_INPUT_CHARS)

    const result = await gateway.run({ kind: 'resumer', input, schema: SummaryOut, noQueue: true })
    if (!result.ok) return { summary: root.summary, stale: root.summary !== null }
    const summary = result.value.data.summary
    repository.saveSummary(rootId, summary, root.version)
    return { summary, stale: false }
  }
}
