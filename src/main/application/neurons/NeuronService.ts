import { randomUUID } from 'node:crypto'
import { CategoryOut } from '@shared/ai/schemas'
import type { Nature, RootListView, RootView, TreeView } from '@shared/ipc/neurons'
import { AppError } from '../../domain/errors'
import { isOutsideNature } from '../../domain/neurons/nature'
import type { NeuronRepository, RootFilter } from '../../infrastructure/db/repositories/NeuronRepository'
import type { AIGateway } from '../ai/AIGateway'

const TITLE_MAX = 120
const CATEGORIZE_PREFIX = 'categorize:'

export interface CreateNeuronInput {
  readonly text: string
  readonly nature?: Nature
}

export interface UpdateNeuronInput {
  readonly id: string
  readonly title?: string
  readonly content?: string | null
  readonly nature?: Nature
  readonly categorySlug?: string
}

/** Titre = première ligne non vide, bornée à 120 caractères. */
function titleOf(text: string): string {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== '') ?? text
  return firstLine.trim().slice(0, TITLE_MAX)
}

/**
 * Neurones racines : création, lecture, liste, modification, archivage (spec 002 FR-001/002).
 * La catégorisation par l'IA locale ne bloque jamais la création ; elle est rejouée si l'IA est absente.
 */
export class NeuronService {
  private readonly inFlight = new Set<Promise<void>>()

  constructor(private readonly deps: { readonly repository: NeuronRepository; readonly gateway: AIGateway }) {}

  async create(input: CreateNeuronInput): Promise<RootView> {
    const text = input.text.trim()
    if (text === '') throw new AppError('VALIDATION', 'Le texte de l’idée est vide')
    const id = randomUUID()
    this.deps.repository.insertRoot({
      id,
      title: titleOf(text),
      content: /\r?\n/.test(text) ? text : null,
      nature: input.nature ?? 'reflection',
      natureSource: input.nature === undefined ? null : 'user'
    })
    this.categorizeInBackground(id, text)
    return this.rootOrThrow(id)
  }

  getTree(rootId: string): TreeView {
    const root = this.rootOrThrow(rootId)
    return {
      root,
      neurons: this.deps.repository.neuronsOf(rootId),
      extensions: this.deps.repository
        .proposedExtensions(rootId)
        .map((extension) => ({ ...extension, outsideNature: isOutsideNature(extension.dimension, root.nature) })),
      suggestions: this.deps.repository.proposedSuggestions(rootId),
      gauge: this.deps.repository.latestGauge(rootId)
    }
  }

  list(filter: RootFilter): RootListView {
    return this.deps.repository.listRoots(filter)
  }

  update(input: UpdateNeuronInput): RootView {
    this.rootOrThrow(input.id)
    let categoryId: string | undefined
    if (input.categorySlug !== undefined) {
      const category = this.deps.repository.categoryBySlug(input.categorySlug)
      if (category === undefined) throw new AppError('VALIDATION', 'Catégorie inconnue')
      categoryId = category.id
    }
    this.deps.repository.updateRoot(input.id, {
      ...(input.title === undefined ? {} : { title: input.title.trim().slice(0, TITLE_MAX) }),
      ...(input.content === undefined ? {} : { content: input.content }),
      ...(input.nature === undefined ? {} : { nature: input.nature, natureSource: 'user' as const }),
      ...(categoryId === undefined ? {} : { categoryId, categorySource: 'user' as const })
    })
    return this.rootOrThrow(input.id)
  }

  archive(rootId: string): RootView {
    this.rootOrThrow(rootId)
    this.deps.repository.updateRoot(rootId, { state: 'archived', archivedAt: new Date().toISOString() })
    return this.rootOrThrow(rootId)
  }

  /** Résultat d'une catégorisation mise en file (IA locale revenue) : appliqué si le neurone existe encore. */
  applyQueuedResult(requestId: string, data: unknown): void {
    if (!requestId.startsWith(CATEGORIZE_PREFIX)) return
    const parsed = CategoryOut.safeParse(data)
    if (parsed.success) this.applyCategory(requestId.slice(CATEGORIZE_PREFIX.length), parsed.data)
  }

  /** Attend la fin des catégorisations en cours (tests, arrêt propre). */
  async settled(): Promise<void> {
    await Promise.all([...this.inFlight])
  }

  private categorizeInBackground(id: string, text: string): void {
    const task = this.deps.gateway
      .run({
        kind: 'categoriser',
        input: text,
        schema: CategoryOut,
        schemaName: 'CategoryOut',
        requestId: `${CATEGORIZE_PREFIX}${id}`
      })
      .then((result) => {
        if (result.ok) this.applyCategory(id, result.value.data)
      })
      .catch(() => undefined)
      .finally(() => this.inFlight.delete(task))
    this.inFlight.add(task)
  }

  private applyCategory(id: string, data: CategoryOut): void {
    const category = this.deps.repository.categoryBySlug(data.categorySlug)
    if (category !== undefined && this.deps.repository.root(id) !== undefined) {
      this.deps.repository.applyCategorization(id, category.id, data.nature)
    }
  }

  private rootOrThrow(id: string): RootView {
    const root = this.deps.repository.root(id)
    if (root === undefined) throw new AppError('NOT_FOUND', 'Idée introuvable')
    return root
  }
}
