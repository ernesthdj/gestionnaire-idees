import { randomUUID } from 'node:crypto'
import {
  BLOCK_DEFAULT_SIZES,
  BLOCK_LIMITS,
  LABEL_MAX_CHARS,
  type BlockKind,
  type BlockView,
  type CanvasFilterInput,
  type CanvasNeuronView,
  type CanvasPosition,
  type IdeasCanvasView
} from '@shared/ipc/canvas'
import type { LinkView, SeedView } from '@shared/ipc/neurons'
import { AppError } from '../../domain/errors'
import type { BlockPatch, BlockRepository } from '../../infrastructure/db/repositories/BlockRepository'
import type { NeuronRepository } from '../../infrastructure/db/repositories/NeuronRepository'

export interface CanvasDeps {
  readonly neurons: Pick<
    NeuronRepository,
    'canvasRoots' | 'matchingRootIds' | 'subNeuronPreviews' | 'categories' | 'savePositions' | 'latestGaugeLevels'
  >
  readonly links: { list(): LinkView[]; seeds(): SeedView[] }
  readonly blocks: Pick<BlockRepository, 'list' | 'get' | 'insert' | 'update' | 'softDelete' | 'log' | 'transaction'>
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

  /** Nouveau bloc au point voulu, à la taille par défaut de son type (spec 004 FR-001). */
  createBlock(input: { readonly kind: BlockKind; readonly x: number; readonly y: number }): BlockView {
    const { kind, x, y } = input
    return this.deps.blocks.insert({ kind, x, y, ...BLOCK_DEFAULT_SIZES[kind], text: kind === 'label' ? '' : null })
  }

  /** Déplacement, redimensionnement (bornes du type) et texte d'une note. */
  updateBlock(patch: BlockPatch): BlockView {
    const current = this.deps.blocks.get(patch.id)
    if (current === undefined) throw new AppError('NOT_FOUND', 'Bloc introuvable')
    const limits = BLOCK_LIMITS[current.kind]
    const fits =
      patch.width >= limits.minWidth &&
      patch.width <= limits.maxWidth &&
      patch.height >= limits.minHeight &&
      patch.height <= limits.maxHeight
    if (!fits) throw new AppError('VALIDATION', 'Taille hors des bornes de ce bloc')
    if (patch.text !== undefined && (current.kind !== 'label' || patch.text.length > LABEL_MAX_CHARS)) {
      throw new AppError('VALIDATION', 'Seule une note porte un texte (2 000 caractères au plus)')
    }
    this.deps.blocks.update(patch)
    return this.deps.blocks.get(patch.id) ?? current
  }

  /** Suppression annulable depuis l'Historique (le bloc revient avec ses versions et sa conversation). */
  deleteBlock(id: string): { readonly batchId: string } {
    const { blocks } = this.deps
    const current = blocks.get(id)
    if (current === undefined) throw new AppError('NOT_FOUND', 'Bloc introuvable')
    const batchId = randomUUID()
    blocks.transaction(() => {
      blocks.softDelete(id)
      blocks.log(batchId, [
        { kind: 'delete', entity: 'canvas_block', entityId: id, before: { kind: current.kind }, after: null }
      ])
    })
    return { batchId }
  }
}
