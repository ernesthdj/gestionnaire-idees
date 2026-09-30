import { randomUUID } from 'node:crypto'
import { ActionPlanOut, ReflectionSummaryOut, type ToolProposal } from '@shared/ai/neurons'
import { BLOCK_DEFAULT_SIZES } from '@shared/ipc/canvas'
import type { ConfirmView, TreeView } from '@shared/ipc/neurons'
import { AppError } from '../../domain/errors'
import { aliasesOf } from '../../domain/neurons/tree'
import { placeTools, type Box } from '../../domain/widgets/placeTools'
import type { BlockRepository } from '../../infrastructure/db/repositories/BlockRepository'
import type { WidgetIoRepository } from '../../infrastructure/db/repositories/WidgetIoRepository'
import type { WidgetRequestRepository } from '../../infrastructure/db/repositories/WidgetRequestRepository'
import type {
  ChangeEntry,
  DependencyInsert,
  FusionRepository,
  PlanNodeInsert,
  SynthesisRow
} from '../../infrastructure/db/repositories/FusionRepository'
import type { GrowthRepository } from '../../infrastructure/db/repositories/GrowthRepository'
import type { ExampleStore } from '../ai/ExampleStore'
import type { NeuronService } from './NeuronService'
import { outline } from './SynthesisContextBuilder'

export interface SynthesisApplierDependencies {
  readonly repository: FusionRepository
  readonly tree: GrowthRepository
  readonly neurons: NeuronService
  readonly examples: ExampleStore
  /** Signale au renderer qu'une proposition ne correspond plus à l'arbre. */
  readonly onStale: (synthesis: SynthesisRow) => void
  /** Outils cochés (spec 006) : blocs, branchements et demandes écrits dans la transaction de l'éclosion. */
  readonly tools?: ToolWriters
}

export interface ToolWriters {
  readonly blocks: Pick<BlockRepository, 'insert'>
  readonly inputs: Pick<WidgetIoRepository, 'insertInput'>
  readonly requests: Pick<WidgetRequestRepository, 'insert'>
  /** L'idée (centre et encombrement) et ce qui l'entoure sur la carte, pour placer les outils sans recouvrement. */
  readonly surroundings: (rootId: string) => { readonly idea: Box; readonly obstacles: readonly Box[] }
}

/**
 * Éclosion (spec 002 research R5) : la synthèse confirmée est appliquée en UNE transaction — plan ou
 * synthèse de réflexion, racine `hatched` et version +1, historique par lot, exemple positif appris.
 */
export class SynthesisApplier {
  constructor(private readonly deps: SynthesisApplierDependencies) {}

  /** Proposition encore valable : existe, proposée, et l'arbre n'a pas bougé depuis (`base_version`). */
  current(synthesisId: string): SynthesisRow {
    const { repository } = this.deps
    const row = repository.synthesis(synthesisId)
    if (row === undefined) throw new AppError('NOT_FOUND', 'Synthèse introuvable')
    if (row.status === 'stale') throw new AppError('STALE', 'L’idée a changé depuis cette synthèse : relance-la')
    if (row.status !== 'proposed') throw new AppError('INVALID_STATE', 'Cette synthèse n’est plus proposée')
    if (this.deps.neurons.getTree(row.rootId).root.version !== row.baseVersion) {
      repository.decide(row.id, 'stale')
      this.deps.onStale(row)
      throw new AppError('STALE', 'L’idée a changé depuis cette synthèse : relance-la')
    }
    return row
  }

  confirm(synthesisId: string, toolIndexes: readonly number[] = []): ConfirmView {
    const row = this.current(synthesisId)
    const { repository } = this.deps
    const chosen = this.chosenTools(row, toolIndexes)
    const toolBlockIds: string[] = []
    const nodes = this.deps.tree.nodesWithHistory(row.rootId)
    const idOf = new Map([...aliasesOf(nodes)].map(([id, alias]) => [alias, id]))
    const before = this.deps.neurons.getTree(row.rootId).root
    const batchId = randomUUID()
    const payload: unknown = JSON.parse(row.payloadJson)

    try {
      repository.transaction(() => {
        const retired = repository.retireCurrentResults(row.rootId)
        const changes =
          row.type === 'action_plan'
            ? this.writePlan(row, ActionPlanOut.parse(payload))
            : this.writeReflection(row, ReflectionSummaryOut.parse(payload), idOf)
        // Les sous-neurones du cycle rejoignent le document : la carte se vide pour le cycle suivant (T064).
        const absorbed = this.deps.tree.absorb(row.rootId, row.id)
        repository.setRootState(row.rootId, 'hatched')
        repository.decide(row.id, 'confirmed', batchId)
        // Exemple appris consigné dans le lot : l'annulation de l'éclosion le retire.
        const exampleId = this.deps.examples.record({
          polarity: 'positive',
          taskKind: 'synthetiser',
          input: outline(nodes),
          output: payload
        })
        const tools = this.writeTools(row.rootId, chosen, toolBlockIds)
        repository.log(batchId, [
          ...retired,
          ...changes,
          ...absorbed,
          {
            kind: 'confirm_synthesis',
            entity: 'example',
            entityId: exampleId,
            before: null,
            after: { taskKind: 'synthetiser' }
          },
          {
            kind: 'confirm_synthesis',
            entity: 'neuron',
            entityId: row.rootId,
            before: { state: before.state, version: before.version },
            after: { state: 'hatched', version: before.version + 1 }
          },
          {
            kind: 'confirm_synthesis',
            entity: 'synthesis',
            entityId: row.id,
            before: { status: 'proposed' },
            after: { status: 'confirmed' }
          },
          // En dernier : l'Historique résume un lot par sa première entrée (ici, l'éclosion).
          ...tools
        ])
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('APPLY_FAILED', 'L’éclosion a échoué : rien n’a été modifié')
    }
    return { batchId, root: this.deps.neurons.getTree(row.rootId).root, toolBlockIds }
  }

  /**
   * Outils cochés (spec 006 FR-005) : positions dans la liste proposée, uniques et existantes. Une synthèse faite
   * sans Claude n'en propose pas (FR-013) : rien à créer.
   */
  private chosenTools(row: SynthesisRow, indexes: readonly number[]): ToolProposal[] {
    if (indexes.length === 0 || row.degraded) return []
    if (new Set(indexes).size !== indexes.length) throw new AppError('VALIDATION', 'Outil coché deux fois')
    const payload: unknown = JSON.parse(row.payloadJson)
    const proposed =
      row.type === 'action_plan' ? ActionPlanOut.parse(payload).tools : ReflectionSummaryOut.parse(payload).tools
    return indexes.map((index) => {
      const tool = proposed[index]
      if (tool === undefined) throw new AppError('VALIDATION', 'Cet outil ne fait pas partie des propositions')
      return tool
    })
  }

  /**
   * Un widget vide par outil coché, placé autour de l'idée, branché sur elle avec les parties annoncées, et sa
   * demande de génération. Dans la transaction de l'éclosion : l'annuler les retire (SC-003).
   */
  private writeTools(rootId: string, chosen: readonly ToolProposal[], created: string[]): ChangeEntry[] {
    const writers = this.deps.tools
    if (chosen.length === 0 || writers === undefined) return []
    const size = BLOCK_DEFAULT_SIZES.widget
    const { idea, obstacles } = writers.surroundings(rootId)
    const places = placeTools(idea, chosen.length, size, obstacles)
    return chosen.flatMap((tool, index): ChangeEntry[] => {
      const place = places[index] ?? { x: idea.x, y: idea.y }
      const block = writers.blocks.insert({ kind: 'widget', ...place, ...size, text: null })
      created.push(block.id)
      writers.requests.insert({
        blockId: block.id,
        rootId,
        title: tool.title,
        description: tool.description,
        producesResult: tool.producesResult
      })
      const entries: ChangeEntry[] = [
        {
          kind: 'confirm_synthesis',
          entity: 'canvas_block',
          entityId: block.id,
          before: null,
          after: { kind: 'widget' }
        }
      ]
      if (tool.parts.length === 0) return entries
      const input = writers.inputs.insertInput({
        blockId: block.id,
        sourceKind: 'idea',
        sourceId: rootId,
        parts: tool.parts
      })
      return [
        ...entries,
        {
          kind: 'confirm_synthesis',
          entity: 'widget_input',
          entityId: input.id,
          before: null,
          after: { sourceKind: 'idea' }
        }
      ]
    })
  }

  /**
   * Approfondir (FR-015, T064) : l'idée repart en développement pour un nouveau cycle de questions. Son document
   * reste en cours : il nourrit les questions et reste lisible jusqu'à la prochaine éclosion qui le remplace.
   */
  reopen(rootId: string): TreeView {
    const root = this.deps.neurons.getTree(rootId).root
    if (root.state !== 'hatched') throw new AppError('NOT_HATCHED', 'Seule une idée éclose peut être rouverte')
    const { repository } = this.deps
    repository.transaction(() => {
      repository.setRootState(rootId, 'developing')
      repository.log(randomUUID(), [
        {
          kind: 'manual_edit',
          entity: 'neuron',
          entityId: rootId,
          before: { state: 'hatched', version: root.version },
          after: { state: 'developing', version: root.version + 1 }
        }
      ])
    })
    return this.deps.neurons.getTree(rootId)
  }

  private writePlan(row: SynthesisRow, plan: ActionPlanOut): ChangeEntry[] {
    const idOf = new Map(plan.nodes.map((node) => [node.ref, randomUUID()]))
    const conditions = new Set(plan.nodes.filter((node) => node.type === 'condition').map((node) => node.ref))
    const waiting = new Set(plan.dependencies.map((dependency) => dependency.toRef))
    const id = (ref: string): string => idOf.get(ref) ?? ref

    const nodes: PlanNodeInsert[] = plan.nodes.map((node) => ({
      id: id(node.ref),
      parentId: node.parentRef === undefined ? null : id(node.parentRef),
      type: node.type,
      title: node.title,
      question: node.question ?? null,
      branchLabel: node.branchLabel ?? null,
      amountCents: node.amountCents ?? null,
      dueDate: node.dueDate ?? null,
      // Bloquée tant qu'une dépendance n'est pas levée ou que la condition parente n'est pas tranchée.
      status:
        waiting.has(node.ref) || (node.parentRef !== undefined && conditions.has(node.parentRef)) ? 'blocked' : 'ready',
      investigation: node.investigation ?? false,
      toSchedule: node.toSchedule ?? false
    }))
    const dependencies: DependencyInsert[] = plan.dependencies.map((dependency) => ({
      id: randomUUID(),
      fromNodeId: id(dependency.fromRef),
      toNodeId: id(dependency.toRef),
      kind: dependency.kind,
      triggerLabel: dependency.triggerLabel ?? null
    }))
    this.deps.repository.insertPlan(row.rootId, row.id, nodes, dependencies)
    return [
      ...nodes.map((node) => ({
        kind: 'confirm_synthesis' as const,
        entity: 'plan_node',
        entityId: node.id,
        before: null,
        after: node
      })),
      ...dependencies.map((dependency) => ({
        kind: 'confirm_synthesis' as const,
        entity: 'plan_dependency',
        entityId: dependency.id,
        before: null,
        after: dependency
      }))
    ]
  }

  /** Les alias `sN` ne valent que pour une version de l'arbre : on stocke les identifiants des sous-neurones. */
  private writeReflection(
    row: SynthesisRow,
    summary: ReflectionSummaryOut,
    idOf: ReadonlyMap<string, string>
  ): ChangeEntry[] {
    const points = (list: ReflectionSummaryOut['keyPoints']): string =>
      JSON.stringify(
        list.map((point) => ({
          ...(point.headline === undefined ? {} : { headline: point.headline }),
          text: point.text,
          sourceIds: point.sourceRefs.flatMap((ref) => idOf.get(ref) ?? [])
        }))
      )
    const insert = {
      id: randomUUID(),
      keyPointsJson: points(summary.keyPoints),
      decisionsJson: points(summary.decisions),
      prosJson: points(summary.pros),
      consJson: points(summary.cons),
      openQuestionsJson: JSON.stringify(summary.openQuestions),
      overview: summary.overview ?? null,
      nextStep: summary.nextStep ?? null
    }
    this.deps.repository.insertReflection(row.rootId, row.id, insert)
    return [
      { kind: 'confirm_synthesis', entity: 'reflection_summary', entityId: insert.id, before: null, after: insert }
    ]
  }
}
