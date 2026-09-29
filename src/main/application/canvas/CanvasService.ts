import {
  BLOCK_DEFAULT_SIZE,
  type BlockView,
  type CanvasFilterInput,
  type CanvasNeuronView,
  type CanvasPosition,
  type IdeasCanvasView
} from '@shared/ipc/canvas'
import type { LinkView, SeedView } from '@shared/ipc/neurons'
import { AppError } from '../../domain/errors'
import type { BlockRepository } from '../../infrastructure/db/repositories/BlockRepository'
import type { NeuronRepository } from '../../infrastructure/db/repositories/NeuronRepository'

export interface CanvasDeps {
  readonly neurons: Pick<
    NeuronRepository,
    'canvasRoots' | 'matchingRootIds' | 'subNeuronPreviews' | 'categories' | 'savePositions' | 'latestGaugeLevels'
  >
  readonly links: { list(): LinkView[]; seeds(): SeedView[] }
  readonly blocks: Pick<BlockRepository, 'list' | 'insert' | 'update' | 'delete'>
}

/** Écran Idées (spec 003 US2, FR-029) : toutes les idées dans un seul espace, leurs liens et leurs graines. */
export class CanvasService {
  constructor(private readonly deps: CanvasDeps) {}

  get(filter: CanvasFilterInput = {}): IdeasCanvasView {
    const roots = this.deps.neurons.canvasRoots()
    const previews = this.deps.neurons.subNeuronPreviews(
      roots.filter((root) => root.state === 'developing').map((root) => root.id)
    )
    const levels = this.deps.neurons.latestGaugeLevels()
    const ideas = roots.map((root): CanvasNeuronView => ({
      ...root,
      subNeurons: previews.get(root.id)?.items ?? [],
      subCount: previews.get(root.id)?.count ?? 0,
      contextLevel: levels.get(root.id) ?? null
    }))
    const visible = new Set(roots.map((root) => root.id))
    // Un lien vers une idée archivée n'a plus de sens sur la carte.
    const links = this.deps.links.list().filter((link) => visible.has(link.a.id) && visible.has(link.b.id))
    const linkIds = new Set(links.map((link) => link.id))
    const seeds = this.deps.links
      .seeds()
      .filter((seed) =>
        seed.status === 'accepted' ? seed.bornRootId !== null && visible.has(seed.bornRootId) : linkIds.has(seed.linkId)
      )
    const filtered = filter.nature !== undefined || filter.categoryId !== undefined || filter.search !== undefined
    return {
      counts: {
        raw: roots.filter((root) => root.state === 'raw').length,
        developing: roots.filter((root) => root.state === 'developing').length,
        hatched: roots.filter((root) => root.state === 'hatched').length
      },
      ideas,
      links,
      seeds,
      categories: this.deps.neurons.categories(),
      highlighted: filtered ? this.deps.neurons.matchingRootIds(filter) : null,
      blocks: this.deps.blocks.list()
    }
  }

  savePositions(positions: readonly CanvasPosition[]): void {
    this.deps.neurons.savePositions(positions)
  }

  createBlock(at: { x: number; y: number }): BlockView {
    return this.deps.blocks.insert({ ...at, ...BLOCK_DEFAULT_SIZE })
  }

  updateBlock(block: BlockView): BlockView {
    if (!this.deps.blocks.update(block)) throw new AppError('NOT_FOUND', 'Bloc introuvable')
    return block
  }

  deleteBlock(id: string): void {
    if (!this.deps.blocks.delete(id)) throw new AppError('NOT_FOUND', 'Bloc introuvable')
  }
}
