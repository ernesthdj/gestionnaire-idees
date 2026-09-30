import type { z } from 'zod'
import { ActionPlanOut, ReflectionSummaryOut } from '@shared/ai/neurons'
import type {
  ConfirmView,
  Nature,
  SynthesisContent,
  SynthesisPatch,
  SynthesisView,
  TreeView
} from '@shared/ipc/neurons'
import { AppError } from '../../domain/errors'
import { checkPlan, checkReflection, type CheckFailure } from '../../domain/neurons/planChecks'
import { applyProvenance } from '../../domain/neurons/provenance'
import { patchPlan, patchReflection } from '../../domain/neurons/synthesisPatch'
import { aliasesOf } from '../../domain/neurons/tree'
import type { FusionRepository, SynthesisRow } from '../../infrastructure/db/repositories/FusionRepository'
import type { GrowthNode, GrowthRepository } from '../../infrastructure/db/repositories/GrowthRepository'
import type { AIGateway } from '../ai/AIGateway'
import type { GrowthEvent } from './GrowthService'
import type { NeuronService } from './NeuronService'
import type { SynthesisApplier } from './SynthesisApplier'
import { buildSynthesisInput, sourceTexts } from './SynthesisContextBuilder'

export type FusionEvent =
  GrowthEvent | { readonly type: 'synthesis:stale'; readonly rootId: string; readonly synthesisId: string }

/** Un appel initial + une nouvelle tentative si un contrôle P1–P5 / S1 échoue. */
const ATTEMPTS = 2

export interface FusionDependencies {
  readonly repository: FusionRepository
  readonly tree: GrowthRepository
  readonly neurons: NeuronService
  readonly gateway: AIGateway
  readonly applier: SynthesisApplier
  /** Suggestions de liens lancées après chaque éclosion (US4), sans bloquer la confirmation. */
  readonly links: { suggestInBackground(rootId: string): void }
  readonly emit: (event: FusionEvent) => void
}

interface Synthesized {
  readonly content: SynthesisContent
  readonly degraded: boolean
}

/**
 * Verrouillage d'un neurone (spec 002 US3) : Claude synthétise l'arbre (plan d'action ou synthèse de réflexion),
 * l'application contrôle le résultat, l'utilisateur le corrige, le refuse ou le confirme. Rien n'est appliqué
 * avant `confirm` (humain dans la boucle).
 */
export class FusionService {
  constructor(private readonly deps: FusionDependencies) {}

  async lock(input: { readonly rootId: string; readonly force?: boolean }): Promise<SynthesisView> {
    const tree = this.deps.neurons.getTree(input.rootId)
    const { root } = tree
    if (root.state === 'hatched' || root.state === 'archived') {
      throw new AppError('INVALID_STATE', 'Cette idée ne peut pas être verrouillée dans son état actuel')
    }
    const forced = input.force === true
    const missing = tree.gauge?.missing ?? []
    if ((tree.gauge?.level ?? 'insufficient') === 'insufficient' && !forced) {
      throw new AppError(
        'CONTEXT_INSUFFICIENT',
        'Le contexte est encore insuffisant : le résultat risque de ne pas être optimal',
        { missing }
      )
    }

    // Double clic ou retour sur l'écran : la proposition encore valable est rendue sans nouvel appel.
    const existing = this.deps.repository.proposedFor(root.id)
    if (existing !== undefined) {
      if (existing.baseVersion === root.version) return this.view(existing)
      this.stale(existing)
    }

    const nodes = this.deps.tree.nodesWithHistory(root.id)
    const request = buildSynthesisInput({ nature: root.nature, nodes, missing, forced })
    const result = await this.synthesize(root.id, root.nature, nodes, request)
    return this.propose(root.id, root.version, result, { instruction: null, forced })
  }

  async revise(input: { readonly synthesisId: string; readonly instruction: string }): Promise<SynthesisView> {
    const row = this.deps.applier.current(input.synthesisId)
    const { root, gauge } = this.deps.neurons.getTree(row.rootId)
    const nodes = this.deps.tree.nodesWithHistory(row.rootId)
    const previous: unknown = JSON.parse(row.payloadJson)
    const result = await this.synthesize(
      row.rootId,
      root.nature,
      nodes,
      buildSynthesisInput({
        nature: root.nature,
        nodes,
        missing: gauge?.missing ?? [],
        forced: row.forced,
        revision: { previous, instruction: input.instruction }
      }),
      'reviser'
    )
    // L'arbre a pu changer pendant l'appel : la correction serait alors fondée sur une version dépassée.
    this.deps.applier.current(row.id)
    return this.propose(row.rootId, row.baseVersion, result, { instruction: input.instruction, forced: row.forced })
  }

  /** Aperçu encore ouvert pour cette idée (retour dans la plongée), sans appel à l'IA ; périmé → `null`. */
  proposed(rootId: string): SynthesisView | null {
    const row = this.deps.repository.proposedFor(rootId)
    if (row === undefined) return null
    if (row.baseVersion !== this.deps.neurons.getTree(rootId).root.version) {
      this.stale(row)
      return null
    }
    return this.view(row)
  }

  /** Correction d'un élément de l'aperçu, revalidée (P1–P5 / S1) avant d'être enregistrée (spec 003 T031). */
  editProposed(input: { readonly synthesisId: string; readonly patch: SynthesisPatch }): SynthesisView {
    const row = this.deps.applier.current(input.synthesisId)
    const known = new Set(aliasesOf(this.deps.tree.nodesWithHistory(row.rootId)).values())
    const payload: unknown = JSON.parse(row.payloadJson)
    const outcome =
      row.type === 'action_plan'
        ? patchPlan(ActionPlanOut.parse(payload), input.patch, known)
        : patchReflection(ReflectionSummaryOut.parse(payload), input.patch, known)
    if (!outcome.ok) throw new AppError('VALIDATION', outcome.message)
    this.deps.repository.updatePayload(row.id, outcome.payload)
    return this.view(this.deps.applier.current(row.id))
  }

  reject(input: { readonly synthesisId: string; readonly reason?: string }): { readonly ok: true } {
    const row = this.deps.repository.synthesis(input.synthesisId)
    if (row === undefined) throw new AppError('NOT_FOUND', 'Synthèse introuvable')
    if (row.status === 'rejected') return { ok: true }
    if (row.status !== 'proposed') throw new AppError('INVALID_STATE', 'Cette synthèse n’est plus proposée')
    this.deps.repository.decide(row.id, 'rejected')
    return { ok: true }
  }

  confirm(synthesisId: string): ConfirmView {
    const confirmed = this.deps.applier.confirm(synthesisId)
    this.deps.links.suggestInBackground(confirmed.root.id)
    return confirmed
  }

  reopen(rootId: string): TreeView {
    return this.deps.applier.reopen(rootId)
  }

  private propose(
    rootId: string,
    baseVersion: number,
    result: Synthesized,
    options: { readonly instruction: string | null; readonly forced: boolean }
  ): SynthesisView {
    const id = this.deps.repository.insertProposal({
      rootId,
      type: result.content.type,
      payload: result.content.type === 'action_plan' ? result.content.plan : result.content.summary,
      baseVersion,
      instruction: options.instruction,
      forced: options.forced,
      degraded: result.degraded
    })
    const row = this.deps.repository.synthesis(id)
    if (row === undefined) throw new AppError('APPLY_FAILED', 'Synthèse non enregistrée')
    return this.view(row)
  }

  /**
   * Appel `synthetiser` / `reviser` avec le schéma de la nature, contrôles P1–P5 / S1 puis provenance P6.
   * En cas d'échec d'un contrôle, une seule nouvelle tentative, en signalant le défaut à corriger.
   */
  private async synthesize(
    rootId: string,
    nature: Nature,
    nodes: readonly GrowthNode[],
    input: string,
    kind: 'synthetiser' | 'reviser' = 'synthetiser'
  ): Promise<Synthesized> {
    const known = new Set(aliasesOf(nodes).values())
    this.deps.emit({ type: 'neuron:thinking', rootId, neuronId: rootId })
    try {
      let failure: CheckFailure | null = null
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const request: string =
          failure === null ? input : `${input}\n\nTa proposition précédente a été refusée : ${failure.message}.`
        const outcome: Synthesized | { readonly failure: CheckFailure } =
          nature === 'action'
            ? await this.attempt(
                rootId,
                kind,
                request,
                ActionPlanOut,
                (plan) => checkPlan(plan, known),
                (plan) => ({
                  type: 'action_plan' as const,
                  plan: applyProvenance(plan, sourceTexts(nodes)).plan
                })
              )
            : await this.attempt(
                rootId,
                kind,
                request,
                ReflectionSummaryOut,
                (summary) => checkReflection(summary, known),
                (summary) => ({
                  type: 'reflection_summary' as const,
                  summary
                })
              )
        if ('content' in outcome) return outcome
        failure = outcome.failure
      }
      throw new AppError(failure?.code ?? 'AI_INVALID_OUTPUT', failure?.message ?? 'Synthèse invalide')
    } finally {
      this.deps.emit({ type: 'neuron:thought', rootId })
    }
  }

  private async attempt<T>(
    rootId: string,
    kind: 'synthetiser' | 'reviser',
    input: string,
    schema: z.ZodType<T>,
    check: (data: T) => CheckFailure | null,
    toContent: (data: T) => SynthesisContent
  ): Promise<Synthesized | { readonly failure: CheckFailure }> {
    const result = await this.deps.gateway.run({
      kind,
      input,
      schema,
      allowDegraded: true,
      onEngine: (engine, model) => this.deps.emit({ type: 'neuron:thinking', rootId, neuronId: rootId, engine, model })
    })
    if (!result.ok) throw new AppError(result.error.code, result.error.message)
    const failure = check(result.value.data)
    return failure === null ? { content: toContent(result.value.data), degraded: result.value.degraded } : { failure }
  }

  private stale(row: SynthesisRow): void {
    this.deps.repository.decide(row.id, 'stale')
    this.deps.emit({ type: 'synthesis:stale', rootId: row.rootId, synthesisId: row.id })
  }

  private view(row: SynthesisRow): SynthesisView {
    const payload: unknown = JSON.parse(row.payloadJson)
    const content: SynthesisContent =
      row.type === 'action_plan'
        ? { type: 'action_plan', plan: ActionPlanOut.parse(payload) }
        : { type: 'reflection_summary', summary: ReflectionSummaryOut.parse(payload) }
    const sources = Object.fromEntries(
      [...aliasesOf(this.deps.tree.nodesWithHistory(row.rootId))].map(([id, alias]) => [alias, id])
    )
    return {
      ...content,
      id: row.id,
      rootId: row.rootId,
      status: row.status,
      baseVersion: row.baseVersion,
      instruction: row.instruction,
      forced: row.forced,
      degraded: row.degraded,
      sources,
      createdAt: row.createdAt
    }
  }
}
