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
  type ProposalView,
  type StepView
} from '@shared/ipc/canvas'
import type { IoLinkView } from '@shared/ipc/widgetIo'
import type { ElementView, MapLinkView } from '@shared/ipc/canvas'
import { AppError } from '../../domain/errors'
import type { BlockPatch, BlockRepository } from '../../infrastructure/db/repositories/BlockRepository'
import type { MapLinkRepository } from '../../infrastructure/db/repositories/MapLinkRepository'
import type { NeuronRepository } from '../../infrastructure/db/repositories/NeuronRepository'
import type { PlanRepository, ProposalRow } from '../../infrastructure/db/repositories/PlanRepository'

export interface CanvasDeps {
  readonly neurons: Pick<
    NeuronRepository,
    'canvasRoots' | 'matchingRootIds' | 'categories' | 'savePositions' | 'latestGaugeLevels'
  >
  readonly blocks: Pick<BlockRepository, 'list' | 'get' | 'insert' | 'update' | 'softDelete' | 'log' | 'transaction'>
  /** Branchements d'entrée des widgets (spec 005). */
  readonly io: { links(): IoLinkView[] }
  /** Liens libres de la carte (spec 007) ; mentalyas en trace entre deux idées (spec 010). */
  readonly mapLinks?: Pick<MapLinkRepository, 'list' | 'insert'>
  /** Résumés des fiches des neurones (spec 008). */
  readonly sheetSummaries?: () => Map<string, string>
  /** Éléments des cartes de structure (spec 009). */
  readonly elements?: { views(): ElementView[] }
  /** Plans d'attaque (spec 011) : étapes, propositions en attente, verrous des genesis. */
  readonly plan?: Pick<PlanRepository, 'steps' | 'pendingProposals' | 'rootLocks'>
}

/** Résumé d'une fiche (affiché sous le nœud) ; absent sans fiche lisible. */
function resumeOf(sheetJson: string | null): string | undefined {
  try {
    const resume = (JSON.parse(sheetJson ?? '{}') as { resume?: unknown }).resume
    return typeof resume === 'string' && resume.trim() !== '' ? resume.trim() : undefined
  } catch {
    return undefined
  }
}

/** Vue d'une proposition : les dépendances par clé locale deviennent des identifiants de fantômes. */
function proposalView(proposal: ProposalRow): ProposalView {
  const pending = proposal.items.filter((item) => item.status === 'en_attente')
  const byKey = new Map(proposal.items.map((item) => [item.key, item.id] as const))
  return {
    id: proposal.id,
    parentId: proposal.parentId,
    items: pending.map((item) => ({
      id: item.id,
      title: item.title,
      why: item.why,
      rank: item.rank,
      waitsFor: item.waitsFor.map((id) => byKey.get(id) ?? id)
    }))
  }
}

/** Écran Idées (spec 003 US2, FR-029) : toutes les idées dans un seul espace, leurs liens, blocs et éléments. */
export class CanvasService {
  constructor(private readonly deps: CanvasDeps) {}

  get(filter: CanvasFilterInput = {}): IdeasCanvasView {
    const roots = this.deps.neurons.canvasRoots()
    const levels = this.deps.neurons.latestGaugeLevels()
    const summaries = this.deps.sheetSummaries?.() ?? new Map<string, string>()
    const locks = this.deps.plan?.rootLocks() ?? new Map<string, { locked: boolean; lockProposed: boolean }>()
    const ideas = roots.map((root): CanvasNeuronView => {
      const summary = summaries.get(root.id)
      return {
        ...root,
        contextLevel: levels.get(root.id) ?? null,
        ...(summary === undefined ? {} : { sheetSummary: summary }),
        locked: locks.get(root.id)?.locked ?? false,
        lockProposed: locks.get(root.id)?.lockProposed ?? false
      }
    })
    const visible = new Set(roots.map((root) => root.id))
    // Un plan d'attaque n'apparaît que si son genesis est sur la carte.
    const steps = (this.deps.plan?.steps() ?? [])
      .filter((step) => visible.has(step.genesisId))
      .map((step): StepView => {
        const summary = resumeOf(step.sheetJson)
        return {
          id: step.id,
          genesisId: step.genesisId,
          parentId: step.parentId,
          depth: step.depth,
          rank: step.rank,
          title: step.title,
          status: step.status,
          locked: step.lockedAt !== null,
          lockProposed: step.lockProposedAt !== null,
          waitsFor: step.waitsFor,
          ...(summary === undefined ? {} : { sheetSummary: summary })
        }
      })
    const nodes = new Set([...visible, ...steps.map((step) => step.id)])
    const proposals = (this.deps.plan?.pendingProposals() ?? [])
      .filter((proposal) => nodes.has(proposal.parentId))
      .map(proposalView)
      .filter((proposal) => proposal.items.length > 0)
    const blocks = this.visibleBlocks()
    // Un élément de structure n'apparaît que si son genesis est sur la carte.
    const elements = (this.deps.elements?.views() ?? []).filter((element) => visible.has(element.genesisId))
    const present = new Set([...visible, ...blocks.map((block) => block.id), ...elements.map((element) => element.id)])
    const filtered = filter.nature !== undefined || filter.categoryId !== undefined || filter.search !== undefined
    return {
      counts: {
        raw: roots.filter((root) => root.state === 'raw').length,
        developing: roots.filter((root) => root.state === 'developing').length,
        hatched: roots.filter((root) => root.state === 'hatched').length
      },
      ideas,
      categories: this.deps.neurons.categories(),
      highlighted: filtered ? this.deps.neurons.matchingRootIds(filter) : null,
      blocks,
      // Un trait n'a de sens que si son idée est encore sur la carte.
      io: this.deps.io.links().filter((link) => link.sourceKind === 'idea' && visible.has(link.sourceId)),
      mapLinks: (this.deps.mapLinks?.list() ?? []).filter(
        (link) => present.has(link.from.id) && present.has(link.to.id)
      ),
      elements,
      steps,
      proposals
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

  /**
   * Lien tracé par mentalyas entre deux idées (spec 010) : un lien libre de la carte, libellé facultatif, annulable.
   * Refusé s'il relie déjà ces deux idées, dans un sens ou dans l'autre.
   */
  createLink(input: { readonly aRootId: string; readonly bRootId: string; readonly label: string }): MapLinkView {
    const { mapLinks } = this.deps
    if (mapLinks === undefined) throw new AppError('INTERNAL', 'Liens de la carte indisponibles')
    if (input.aRootId === input.bRootId) throw new AppError('VALIDATION', 'Une idée ne se relie pas à elle-même')
    const ideas = new Set(this.deps.neurons.canvasRoots().map((root) => root.id))
    if (!ideas.has(input.aRootId) || !ideas.has(input.bRootId)) throw new AppError('NOT_FOUND', 'Idée introuvable')
    const pair = new Set([input.aRootId, input.bRootId])
    const exists = mapLinks
      .list()
      .some(
        (link) => link.from.kind === 'idea' && link.to.kind === 'idea' && pair.has(link.from.id) && pair.has(link.to.id)
      )
    if (exists) throw new AppError('DUPLICATE', 'Ces deux idées sont déjà reliées')
    const label = input.label.trim() === '' ? null : input.label.trim()
    const { blocks } = this.deps
    return blocks.transaction(() => {
      const link = mapLinks.insert({
        from: { kind: 'idea', id: input.aRootId },
        to: { kind: 'idea', id: input.bRootId },
        label,
        origin: 'user'
      })
      blocks.log(randomUUID(), [
        { kind: 'link', entity: 'map_link', entityId: link.id, before: null, after: { label } }
      ])
      return link
    })
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
