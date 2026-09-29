import { randomUUID } from 'node:crypto'
import { SuggererLiensOut } from '@shared/ai/neurons'
import type { LinkStatus, LinkView } from '@shared/ipc/neurons'
import { AppError } from '../../domain/errors'
import {
  CANDIDATE_CHARS,
  linkFingerprint,
  orderedPair,
  rankCandidates,
  TARGET_CHARS,
  type RankedCandidate
} from '../../domain/neurons/links'
import type { LinkRepository, LinkRow } from '../../infrastructure/db/repositories/LinkRepository'
import type { AIGateway } from '../ai/AIGateway'
import type { ExampleStore } from '../ai/ExampleStore'
import type { SeedService } from './SeedService'

export type LinkEvent = { readonly type: 'links:suggested'; readonly rootId: string; readonly count: number }

const LABEL_MAX = 40

export interface LinkDependencies {
  readonly repository: LinkRepository
  readonly gateway: AIGateway
  readonly examples: ExampleStore
  /** Graines portées par les liens (FR-028). */
  readonly seeds: Pick<SeedService, 'record' | 'germinateInBackground'>
  readonly emit: (event: LinkEvent) => void
}

function snippet(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/**
 * Liens entre idées écloses (spec 002 US4). Les candidats sont choisis localement (graphe de mots-clés) :
 * Claude ne reçoit que des fiches courtes, et n'est pas appelé si aucune idée n'est proche.
 */
export class LinkService {
  private readonly inFlight = new Set<Promise<void>>()

  constructor(private readonly deps: LinkDependencies) {}

  /** Après une éclosion, sans bloquer la confirmation. */
  suggestInBackground(rootId: string): void {
    const task = this.suggestFor(rootId)
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => this.inFlight.delete(task))
    this.inFlight.add(task)
  }

  async settled(): Promise<void> {
    await Promise.all([...this.inFlight])
  }

  /** Demande 0 à 3 liens pour l'idée qui vient d'éclore ; renvoie le nombre de suggestions retenues. */
  async suggestFor(rootId: string): Promise<number> {
    const { repository } = this.deps
    const fiches = repository.hatchedFiches()
    const target = fiches.find((fiche) => fiche.id === rootId)
    if (target === undefined) return 0
    const candidates = rankCandidates(target, fiches)
    if (candidates.length === 0) return 0

    const result = await this.deps.gateway.run({
      kind: 'suggerer_liens',
      schema: SuggererLiensOut,
      allowDegraded: true,
      input: [
        `Idée qui vient d'éclore : ${snippet(target.text, TARGET_CHARS)}`,
        `Idées candidates :\n${candidates.map((entry) => `- [${entry.alias}] ${snippet(entry.fiche.text, CANDIDATE_CHARS)}`).join('\n')}`,
        'Consigne : propose 0 à 3 liens utiles entre l’idée qui vient d’éclore et des candidates.'
      ].join('\n\n')
    })
    if (!result.ok) return 0

    const byAlias = new Map(candidates.map((entry) => [entry.alias, entry]))
    const known = repository.fingerprints()
    let count = 0
    for (const proposal of result.value.data.links) {
      const candidate: RankedCandidate | undefined = byAlias.get(proposal.targetAlias)
      if (candidate === undefined) continue // L1 : alias inconnu → suggestion retirée
      const fingerprint = linkFingerprint(rootId, candidate.fiche.id, proposal.label)
      if (known.has(fingerprint)) continue // déjà proposée, acceptée ou refusée
      const [a, b] = orderedPair(rootId, candidate.fiche.id)
      const linkId = repository.insert({
        aRootId: a,
        bRootId: b,
        label: proposal.label,
        justification: proposal.justification,
        origin: 'ai',
        status: 'suggested',
        fingerprint
      })
      if (proposal.seed !== undefined) this.deps.seeds.record(linkId, proposal.seed)
      known.set(fingerprint, 'suggested')
      count++
    }
    if (count > 0) this.deps.emit({ type: 'links:suggested', rootId, count })
    return count
  }

  list(status?: LinkStatus): LinkView[] {
    return this.deps.repository.list(status)
  }

  decide(input: { readonly linkId: string; readonly accept: boolean }): LinkView {
    const row = this.rowOrThrow(input.linkId)
    if (row.status !== 'suggested') throw new AppError('INVALID_STATE', 'Cette suggestion a déjà été traitée')
    const status: LinkStatus = input.accept ? 'accepted' : 'rejected'
    const { repository } = this.deps
    repository.transaction(() => {
      repository.update(row.id, { status })
      if (input.accept) {
        repository.log(randomUUID(), [
          { kind: 'link', entity: 'neuron_link', entityId: row.id, before: { status: 'suggested' }, after: { status } }
        ])
      }
      this.deps.examples.record({
        polarity: input.accept ? 'positive' : 'negative',
        taskKind: 'suggerer_liens',
        input: `${repository.rootTitle(row.aRootId) ?? ''} ↔ ${repository.rootTitle(row.bRootId) ?? ''}`,
        output: { label: row.label, justification: row.justification }
      })
    })
    return this.viewOf(row.id)
  }

  create(input: { readonly aRootId: string; readonly bRootId: string; readonly label: string }): LinkView {
    const { repository } = this.deps
    const label = input.label.trim().slice(0, LABEL_MAX)
    if (input.aRootId === input.bRootId) throw new AppError('VALIDATION', 'Un lien relie deux idées différentes')
    if (repository.rootTitle(input.aRootId) === undefined || repository.rootTitle(input.bRootId) === undefined) {
      throw new AppError('NOT_FOUND', 'Idée introuvable')
    }
    const fingerprint = linkFingerprint(input.aRootId, input.bRootId, label)
    const existing = repository.fingerprints().get(fingerprint)
    if (existing === 'accepted' || existing === 'suggested') throw new AppError('DUPLICATE', 'Ce lien existe déjà')
    const [a, b] = orderedPair(input.aRootId, input.bRootId)
    const id = repository.transaction(() => {
      const created = repository.insert({
        aRootId: a,
        bRootId: b,
        label,
        justification: null,
        origin: 'user',
        status: 'accepted',
        fingerprint
      })
      repository.log(randomUUID(), [
        { kind: 'link', entity: 'neuron_link', entityId: created, before: null, after: { a, b, label } }
      ])
      return created
    })
    this.deps.seeds.germinateInBackground(id)
    return this.viewOf(id)
  }

  update(input: { readonly linkId: string; readonly label: string }): LinkView {
    const row = this.rowOrThrow(input.linkId)
    const label = input.label.trim().slice(0, LABEL_MAX)
    if (label === '') throw new AppError('VALIDATION', 'Le libellé est vide')
    const { repository } = this.deps
    repository.transaction(() => {
      repository.update(row.id, { label, fingerprint: linkFingerprint(row.aRootId, row.bRootId, label) })
      repository.log(randomUUID(), [
        { kind: 'link', entity: 'neuron_link', entityId: row.id, before: { label: row.label }, after: { label } }
      ])
    })
    return this.viewOf(row.id)
  }

  delete(linkId: string): { readonly ok: true } {
    const row = this.rowOrThrow(linkId)
    const { repository } = this.deps
    repository.transaction(() => {
      repository.delete(row.id)
      repository.log(randomUUID(), [
        {
          kind: 'link',
          entity: 'neuron_link',
          entityId: row.id,
          before: { a: row.aRootId, b: row.bRootId, label: row.label, status: row.status },
          after: null
        }
      ])
    })
    return { ok: true }
  }

  private rowOrThrow(id: string): LinkRow {
    const row = this.deps.repository.link(id)
    if (row === undefined) throw new AppError('NOT_FOUND', 'Lien introuvable')
    return row
  }

  private viewOf(id: string): LinkView {
    return this.deps.repository.view(this.rowOrThrow(id))
  }
}
