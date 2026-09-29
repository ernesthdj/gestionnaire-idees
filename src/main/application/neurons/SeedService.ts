import { randomUUID } from 'node:crypto'
import { GermerOut, type SeedOut } from '@shared/ai/neurons'
import type { SeedView } from '@shared/ipc/neurons'
import { AppError } from '../../domain/errors'
import { CANDIDATE_CHARS } from '../../domain/neurons/links'
import type { LinkRepository, SeedRow } from '../../infrastructure/db/repositories/LinkRepository'
import type { AIGateway } from '../ai/AIGateway'
import type { ExampleStore } from '../ai/ExampleStore'
import type { NeuronService } from './NeuronService'

export type SeedEvent = { readonly type: 'seeds:suggested'; readonly linkId: string }

export interface SeedDependencies {
  readonly repository: LinkRepository
  readonly neurons: NeuronService
  readonly gateway: AIGateway
  readonly examples: ExampleStore
  readonly emit: (event: SeedEvent) => void
}

function snippet(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/**
 * Graines d'idées sur les liens (spec 003 FR-028) : une idée nouvelle née de la rencontre de deux idées reliées.
 * Rien ne se crée sans acceptation ; une graine refusée n'est jamais reproposée pour ce lien.
 */
export class SeedService {
  private readonly inFlight = new Set<Promise<void>>()

  constructor(private readonly deps: SeedDependencies) {}

  /** Graine proposée avec un lien (même réponse que `suggerer_liens`) : enregistrée, visible si le lien est accepté. */
  record(linkId: string, seed: SeedOut): boolean {
    return this.deps.repository.insertSeed({ linkId, title: seed.title, why: seed.why })
  }

  /** Après un lien créé par l'utilisateur, sans le bloquer. */
  germinateInBackground(linkId: string): void {
    const task = this.germinate(linkId)
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => this.inFlight.delete(task))
    this.inFlight.add(task)
  }

  async settled(): Promise<void> {
    await Promise.all([...this.inFlight])
  }

  /** Demande 0 ou 1 graine pour ce lien ; `true` si une graine a été enregistrée. */
  async germinate(linkId: string): Promise<boolean> {
    const { repository } = this.deps
    const link = repository.link(linkId)
    if (link === undefined || link.status !== 'accepted' || repository.hasSeed(linkId)) return false
    const fiches = repository.fichesOf([link.aRootId, link.bRootId])
    const a = fiches.find((fiche) => fiche.id === link.aRootId)
    const b = fiches.find((fiche) => fiche.id === link.bRootId)
    if (a === undefined || b === undefined) return false

    const result = await this.deps.gateway.run({
      kind: 'germer',
      schema: GermerOut,
      allowDegraded: true,
      input: [
        `Idée A : ${snippet(a.text, CANDIDATE_CHARS)}`,
        `Idée B : ${snippet(b.text, CANDIDATE_CHARS)}`,
        `Lien : « ${link.label} »`,
        'Consigne : propose une graine seulement si une idée nouvelle naît vraiment de ces deux idées.'
      ].join('\n\n')
    })
    const seed = result.ok ? result.value.data.seed : undefined
    // Le lien a pu être supprimé pendant l'appel : la clé étrangère refuserait la graine.
    if (seed === undefined || repository.link(linkId) === undefined) return false
    const recorded = this.record(linkId, seed)
    if (recorded) this.deps.emit({ type: 'seeds:suggested', linkId })
    return recorded
  }

  list(): SeedView[] {
    return this.deps.repository.seeds()
  }

  /** L'idée née est brute, placée entre ses parents ; l'acceptation est un lot annulable de l'historique. */
  accept(seedId: string): { readonly seed: SeedView; readonly rootId: string; readonly batchId: string } {
    const { repository } = this.deps
    const seed = this.pendingOrThrow(seedId)
    const link = repository.link(seed.linkId)
    if (link === undefined || link.status !== 'accepted') {
      throw new AppError('INVALID_STATE', 'Le lien de cette graine n’est plus accepté')
    }
    const batchId = randomUUID()
    const rootId = repository.transaction(() => {
      const id = this.deps.neurons.insert({
        text: `${seed.title}\n${seed.why}`,
        ...this.midpoint(link.aRootId, link.bRootId)
      })
      repository.updateSeed(seed.id, { status: 'accepted', bornRootId: id })
      repository.log(batchId, [
        {
          kind: 'seed',
          entity: 'link_seed',
          entityId: seed.id,
          before: { status: 'suggested', bornRootId: null },
          after: { status: 'accepted', bornRootId: id }
        },
        { kind: 'seed', entity: 'neuron', entityId: id, before: null, after: { state: 'raw', version: 0 } }
      ])
      this.recordExample(seed, 'positive')
      return id
    })
    this.deps.neurons.categorizeInBackground(rootId)
    return { seed: this.viewOrThrow(seed.id), rootId, batchId }
  }

  reject(seedId: string): { readonly ok: true } {
    const { repository } = this.deps
    const seed = this.pendingOrThrow(seedId)
    repository.transaction(() => {
      repository.updateSeed(seed.id, { status: 'rejected' })
      this.recordExample(seed, 'negative')
    })
    return { ok: true }
  }

  private midpoint(a: string, b: string): { readonly position?: { readonly x: number; readonly y: number } } {
    const pa = this.deps.repository.position(a)
    const pb = this.deps.repository.position(b)
    return pa === undefined || pb === undefined ? {} : { position: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 } }
  }

  private recordExample(seed: SeedRow, polarity: 'positive' | 'negative'): void {
    const link = this.deps.repository.link(seed.linkId)
    const title = (id: string | undefined): string =>
      id === undefined ? '' : (this.deps.repository.rootTitle(id) ?? '')
    this.deps.examples.record({
      polarity,
      taskKind: 'germer',
      input: `${title(link?.aRootId)} × ${title(link?.bRootId)}`,
      output: { title: seed.title, why: seed.why }
    })
  }

  private pendingOrThrow(id: string): SeedRow {
    const seed = this.deps.repository.seed(id)
    if (seed === undefined) throw new AppError('NOT_FOUND', 'Graine introuvable')
    if (seed.status !== 'suggested') throw new AppError('INVALID_STATE', 'Cette graine a déjà été traitée')
    return seed
  }

  private viewOrThrow(id: string): SeedView {
    const view = this.deps.repository.seeds().find((seed) => seed.id === id)
    if (view === undefined) throw new AppError('NOT_FOUND', 'Graine introuvable')
    return view
  }
}
