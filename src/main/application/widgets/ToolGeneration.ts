import type { WidgetRequestView, WidgetView } from '@shared/ipc/widgets'
import { AppError } from '../../domain/errors'
import { toolRequestText } from '../../domain/widgets/toolProposals'
import type { WidgetRequestRepository } from '../../infrastructure/db/repositories/WidgetRequestRepository'
import type { WidgetService } from './WidgetService'

export interface ToolGenerationDependencies {
  readonly requests: Pick<WidgetRequestRepository, 'get' | 'remove'>
  readonly widgets: Pick<WidgetService, 'prompt'>
  /** Le widget existe-t-il encore (une éclosion annulée l'a retiré) ? */
  readonly exists: (blockId: string) => boolean
}

/**
 * Génération des outils cochés à l'éclosion (spec 006 FR-006, FR-010) : après la transaction, un appel `widget`
 * par outil, l'un après l'autre, en arrière-plan. Un échec reste attaché à son widget (« Réessayer ») et ne touche
 * ni l'éclosion ni les autres outils. La demande envoyée est la proposition ; le service de widgets y joint la
 * structure des entrées branchées, jamais leurs valeurs.
 */
export class ToolGeneration {
  private readonly queue: string[] = []
  private running: string | null = null
  private drained: Promise<void> = Promise.resolve()

  constructor(private readonly deps: ToolGenerationDependencies) {}

  /** Met en file les widgets créés par une éclosion ; rend la main aussitôt. */
  start(blockIds: readonly string[]): void {
    const fresh = blockIds.filter((id) => id !== this.running && !this.queue.includes(id))
    if (fresh.length === 0) return
    this.queue.push(...fresh)
    if (this.running === null) this.drained = this.drain()
  }

  /** Fin de la file (tests, arrêt de l'app). */
  settled(): Promise<void> {
    return this.drained
  }

  /** « Réessayer » : relance la demande attachée au widget et attend le résultat. */
  async retry(blockId: string): Promise<WidgetView> {
    if (this.running === blockId || this.queue.includes(blockId)) {
      throw new AppError('INVALID_STATE', 'Claude prépare déjà cet outil')
    }
    if (this.deps.requests.get(blockId) === undefined) {
      throw new AppError('NOT_FOUND', 'Aucune demande en attente pour ce widget')
    }
    this.running = blockId
    try {
      return await this.generate(blockId)
    } finally {
      this.running = null
      if (this.queue.length > 0) this.drained = this.drain()
    }
  }

  /** État de la demande d'un widget, pour l'interface : en file, en cours, ou à relancer. */
  view(blockId: string): WidgetRequestView | null {
    const request = this.deps.requests.get(blockId)
    if (request === undefined) return null
    const state = this.running === blockId ? 'running' : this.queue.includes(blockId) ? 'queued' : 'idle'
    return { title: request.title, description: request.description, state }
  }

  private async drain(): Promise<void> {
    for (let next = this.queue.shift(); next !== undefined; next = this.queue.shift()) {
      this.running = next
      try {
        await this.generate(next)
      } catch {
        // Widget retiré entre-temps (éclosion annulée) : rien à faire, la file continue.
      } finally {
        this.running = null
      }
    }
  }

  private async generate(blockId: string): Promise<WidgetView> {
    const request = this.deps.requests.get(blockId)
    if (request === undefined || !this.deps.exists(blockId)) {
      throw new AppError('NOT_FOUND', 'Widget introuvable')
    }
    const view = await this.deps.widgets.prompt({ blockId, text: toolRequestText(request) })
    // Une première version est née : la demande a abouti. Sinon l'échec est déjà expliqué dans la conversation.
    if (view.current !== null) this.deps.requests.remove(blockId)
    return view
  }
}
