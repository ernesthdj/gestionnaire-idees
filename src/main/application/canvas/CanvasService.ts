import { randomUUID } from 'node:crypto'
import {
  BLOCK_DEFAULT_SIZES,
  BLOCK_LIMITS,
  LABEL_MAX_CHARS,
  type CreatableBlockKind,
  type BlockView,
  type CanvasFilterInput,
  type CanvasNeuronView,
  type CanvasPosition,
  type IdeasCanvasView,
  type StepView
} from '@shared/ipc/canvas'
import type { HatchedResultView, LinkView, SeedView } from '@shared/ipc/neurons'
import type { IoLinkView } from '@shared/ipc/widgetIo'
import type { MapLinkView } from '@shared/ipc/canvas'
import { AppError } from '../../domain/errors'
import { nextStepOf } from '../../domain/neurons/nextStep'
import type { BlockPatch, BlockRepository } from '../../infrastructure/db/repositories/BlockRepository'
import type { NeuronRepository } from '../../infrastructure/db/repositories/NeuronRepository'

export interface CanvasDeps {
  readonly neurons: Pick<
    NeuronRepository,
    'canvasRoots' | 'matchingRootIds' | 'subNeuronPreviews' | 'categories' | 'savePositions' | 'latestGaugeLevels'
  >
  readonly links: { list(): LinkView[]; seeds(): SeedView[] }
  readonly blocks: Pick<BlockRepository, 'list' | 'get' | 'insert' | 'update' | 'softDelete' | 'log' | 'transaction'>
  /** Branchements d'entrée des widgets (spec 005). */
  readonly io: { links(): IoLinkView[] }
  /** Liens libres de la carte (spec 007). */
  readonly mapLinks?: { list(): MapLinkView[] }
  /** Résumés des fiches des neurones (spec 008). */
  readonly sheetSummaries?: () => Map<string, string>
  /** Documents en cours des idées (prochaine étape) et places mémorisées des étapes. */
  readonly steps: {
    result(rootId: string): HatchedResultView | null
    stepPlaces(): Map<string, { readonly x: number; readonly y: number }>
    saveStepPlace(rootId: string, place: { readonly x: number; readonly y: number }): void
  }
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
    const summaries = this.deps.sheetSummaries?.() ?? new Map<string, string>()
    const ideas = roots.map((root): CanvasNeuronView => {
      const summary = summaries.get(root.id)
      return {
        ...root,
        subNeurons: previews.get(root.id)?.items ?? [],
        subCount: previews.get(root.id)?.count ?? 0,
        contextLevel: levels.get(root.id) ?? null,
        ...(summary === undefined ? {} : { sheetSummary: summary })
      }
    })
    const visible = new Set(roots.map((root) => root.id))
    // Un lien vers une idée archivée n'a plus de sens sur la carte.
    const links = this.deps.links.list().filter((link) => visible.has(link.a.id) && visible.has(link.b.id))
    const linkIds = new Set(links.map((link) => link.id))
    const seeds = this.deps.links
      .seeds()
      .filter((seed) =>
        seed.status === 'accepted' ? seed.bornRootId !== null && visible.has(seed.bornRootId) : linkIds.has(seed.linkId)
      )
    // Une idée brute n'a jamais eu de document ; les autres portent la prochaine étape de leur document en cours.
    const places = this.deps.steps.stepPlaces()
    const steps = roots.flatMap((root): StepView[] => {
      const text = root.state === 'raw' ? null : nextStepOf(this.deps.steps.result(root.id))
      return text === null ? [] : [{ rootId: root.id, text, position: places.get(root.id) ?? null }]
    })
    const blocks = this.visibleBlocks()
    const present = new Set([...visible, ...blocks.map((block) => block.id)])
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
      blocks,
      steps,
      // Un trait n'a de sens que si sa source est encore sur la carte (idée visible, étape présente).
      io: this.deps.io
        .links()
        .filter((link) =>
          link.sourceKind === 'idea' ? visible.has(link.sourceId) : steps.some((step) => step.rootId === link.sourceId)
        ),
      mapLinks: (this.deps.mapLinks?.list() ?? []).filter(
        (link) => present.has(link.from.id) && present.has(link.to.id)
      )
    }
  }

  /** Un cadre résultat suit son widget : widget supprimé, cadre masqué (il revient si la suppression est annulée). */
  private visibleBlocks(): BlockView[] {
    const blocks = this.deps.blocks.list()
    const ids = new Set(blocks.map((block) => block.id))
    return blocks.filter((block) => block.sourceBlockId === null || ids.has(block.sourceBlockId))
  }

  savePositions(positions: readonly CanvasPosition[]): void {
    this.deps.neurons.savePositions(positions)
  }

  /** Étape glissée à la main : elle reste épinglée à cette place. */
  saveStepPosition(input: { readonly rootId: string; readonly x: number; readonly y: number }): void {
    if (nextStepOf(this.deps.steps.result(input.rootId)) === null) {
      throw new AppError('NOT_FOUND', 'Cette idée n’a pas de prochaine étape')
    }
    this.deps.steps.saveStepPlace(input.rootId, { x: input.x, y: input.y })
  }

  /** Nouveau bloc au point voulu, à la taille par défaut de son type (spec 004 FR-001). */
  createBlock(input: { readonly kind: CreatableBlockKind; readonly x: number; readonly y: number }): BlockView {
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
    // Un cadre (spec 007) part avec les blocs qu'il regroupe, dans le même lot annulable ; les idées restent.
    const removed =
      current.kind === 'frame' ? [current, ...blocks.list().filter((block) => block.frameId === id)] : [current]
    blocks.transaction(() => {
      for (const block of removed) blocks.softDelete(block.id)
      blocks.log(
        batchId,
        removed.map((block) => ({
          kind: 'delete' as const,
          entity: 'canvas_block',
          entityId: block.id,
          before: { kind: block.kind },
          after: null
        }))
      )
    })
    return { batchId }
  }
}
