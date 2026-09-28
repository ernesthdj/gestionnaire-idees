import { randomUUID } from 'node:crypto'
import { ActionPlanOut, ReflectionSummaryOut } from '@shared/ai/neurons'
import type { ConfirmView, TreeView } from '@shared/ipc/neurons'
import { AppError } from '../../domain/errors'
import { aliasesOf } from '../../domain/neurons/tree'
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

  confirm(synthesisId: string): ConfirmView {
    const row = this.current(synthesisId)
    const { repository } = this.deps
    const nodes = this.deps.tree.nodes(row.rootId)
    const idOf = new Map([...aliasesOf(nodes)].map(([id, alias]) => [alias, id]))
    const before = this.deps.neurons.getTree(row.rootId).root
    const batchId = randomUUID()
    const payload: unknown = JSON.parse(row.payloadJson)

    try {
      repository.transaction(() => {
        repository.retireCurrentResults(row.rootId)
        const changes =
          row.type === 'action_plan'
            ? this.writePlan(row, ActionPlanOut.parse(payload))
            : this.writeReflection(row, ReflectionSummaryOut.parse(payload), idOf)
        repository.setRootState(row.rootId, 'hatched')
        repository.decide(row.id, 'confirmed', batchId)
        // Exemple appris consigné dans le lot : l'annulation de l'éclosion le retire.
        const exampleId = this.deps.examples.record({
          polarity: 'positive',
          taskKind: 'synthetiser',
          input: outline(nodes),
          output: payload
        })
        repository.log(batchId, [
          ...changes,
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
          }
        ])
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('APPLY_FAILED', 'L’éclosion a échoué : rien n’a été modifié')
    }
    return { batchId, root: this.deps.neurons.getTree(row.rootId).root }
  }

  /** Réouverture (FR-015) : l'idée repart en développement, plan et synthèse précédents restent consultables. */
  reopen(rootId: string): TreeView {
    const root = this.deps.neurons.getTree(rootId).root
    if (root.state !== 'hatched') throw new AppError('NOT_HATCHED', 'Seule une idée éclose peut être rouverte')
    const { repository } = this.deps
    repository.transaction(() => {
      repository.retireCurrentResults(rootId)
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
        list.map((point) => ({ text: point.text, sourceIds: point.sourceRefs.flatMap((ref) => idOf.get(ref) ?? []) }))
      )
    const insert = {
      id: randomUUID(),
      keyPointsJson: points(summary.keyPoints),
      decisionsJson: points(summary.decisions),
      prosJson: points(summary.pros),
      consJson: points(summary.cons),
      openQuestionsJson: JSON.stringify(summary.openQuestions)
    }
    this.deps.repository.insertReflection(row.rootId, row.id, insert)
    return [
      { kind: 'confirm_synthesis', entity: 'reflection_summary', entityId: insert.id, before: null, after: insert }
    ]
  }
}
