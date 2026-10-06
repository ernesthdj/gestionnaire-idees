import type { RootView } from '@shared/ipc/neurons'
import type { DocumentData, PlanStepData } from '@shared/ipc/widgetIo'
import { rankLabel } from '@shared/plan/rankLabel'
import { readSheet } from '../../domain/conversation/sheet'
import type { PlanNodeRow, StepRow } from '../../infrastructure/db/repositories/PlanRepository'
import type { IdeaFacts, StepFacts } from './InputAssembler'

/** Ce que les widgets lisent des plans d'attaque, fiches, documents et actions finales (spec 015). */
export interface PlanContextPort {
  readonly node: (id: string) => PlanNodeRow | undefined
  readonly steps: (genesisId: string) => readonly StepRow[]
  readonly sheetJson: (id: string) => string | null
  readonly whyOf: (stepId: string) => string | null
  /** Action finale de l'étape et fichiers de son livrable (spec 013) ; `null` pour une étape ordinaire. */
  readonly final: (stepId: string) => {
    readonly deliverable: string
    readonly state: string
    readonly files: readonly { readonly path: string; readonly status: 'cree' | 'modifie' }[]
  } | null
  /** Documents annexés à ces neurones (spec 012) : contenu actuel, ou dernière version connue. */
  readonly documents: (neuronIds: ReadonlySet<string>) => readonly DocumentData[]
}

/** Profondeur maximale d'un plan (spec 011) : garde-fou des remontées d'ancêtres. */
const MAX_DEPTH = 10

/** Ancêtres d'une étape, du plus haut (sous le genesis) au parent direct. */
function ancestorsOf(step: StepRow, byId: ReadonlyMap<string, StepRow>): StepRow[] {
  const ancestors: StepRow[] = []
  let parent = byId.get(step.parentId)
  for (let guard = 0; parent !== undefined && guard < MAX_DEPTH; guard++) {
    ancestors.unshift(parent)
    parent = byId.get(parent.parentId)
  }
  return ancestors
}

/** Parcours en profondeur, frères par rang : un parent est toujours suivi de ses descendants. */
function inTreeOrder(steps: readonly StepRow[]): StepRow[] {
  const ids = new Set(steps.map((step) => step.id))
  const children = new Map<string, StepRow[]>()
  for (const step of steps) children.set(step.parentId, [...(children.get(step.parentId) ?? []), step])
  const ordered: StepRow[] = []
  const visit = (list: readonly StepRow[]): void => {
    for (const step of [...list].sort((a, b) => a.rank - b.rank)) {
      ordered.push(step)
      visit(children.get(step.id) ?? [])
    }
  }
  visit(steps.filter((step) => !ids.has(step.parentId)))
  return ordered
}

/**
 * Faits transmis aux widgets pour une idée ou une étape de plan (spec 015) : lus ici, assemblés ensuite par les
 * fonctions pures de `InputAssembler`.
 */
export class PlanFacts {
  constructor(
    private readonly port: PlanContextPort,
    /** Le genesis est-il encore sur la carte (non archivé) ? */
    private readonly liveRoot: (rootId: string) => boolean
  ) {}

  /** Étape vivante d'un plan, dans un genesis encore sur la carte. */
  liveStep(stepId: string): StepRow | undefined {
    const node = this.port.node(stepId)
    if (node === undefined || node.kind !== 'step' || !this.liveRoot(node.rootId)) return undefined
    return this.port.steps(node.genesisId).find((step) => step.id === stepId)
  }

  /** Rangs du chemin d'une étape, de l'étape de niveau 1 à elle-même. */
  ranks(step: StepRow, steps: readonly StepRow[] = this.port.steps(step.genesisId)): number[] {
    const byId = new Map(steps.map((entry) => [entry.id, entry]))
    return [...ancestorsOf(step, byId).map((ancestor) => ancestor.rank), step.rank]
  }

  /** Rang d'une étape transmis au widget : chiffres simples (« 1.2.3 »), faciles à exploiter dans son code. */
  label(step: StepRow, steps?: readonly StepRow[]): string {
    return this.ranks(step, steps).join('.')
  }

  /** Rang affiché dans la revue, au style de la carte (« ①.2.3 »). */
  displayLabel(step: StepRow): string {
    return rankLabel(this.ranks(step))
  }

  idea(root: RootView): Omit<IdeaFacts, 'id' | 'title' | 'nature' | 'category' | 'state' | 'originalText'> {
    return {
      sheet: readSheet(this.port.sheetJson(root.id)),
      plan: this.plan(this.port.steps(root.id)),
      documents: this.port.documents(new Set([root.id]))
    }
  }

  step(stepId: string): StepFacts | undefined {
    const step = this.liveStep(stepId)
    if (step === undefined) return undefined
    const steps = this.port.steps(step.genesisId)
    const byId = new Map(steps.map((entry) => [entry.id, entry]))
    const genesis = this.port.node(step.genesisId)
    const below = steps.filter((entry) => ancestorsOf(entry, byId).some((ancestor) => ancestor.id === step.id))
    const final = this.port.final(step.id)
    return {
      id: step.id,
      genesisId: step.genesisId,
      title: step.title,
      label: this.label(step, steps),
      rank: step.rank,
      depth: step.depth,
      status: step.status,
      why: this.port.whyOf(step.id),
      final: final === null ? null : { deliverable: final.deliverable, state: final.state },
      sheet: readSheet(step.sheetJson),
      // Chemin : genesis d'abord, puis les étapes parentes jusqu'à la parente directe.
      path: [
        ...(genesis === undefined
          ? []
          : [
              {
                id: genesis.id,
                kind: 'genesis' as const,
                label: null,
                title: genesis.title,
                sheet: readSheet(this.port.sheetJson(genesis.id))
              }
            ]),
        ...ancestorsOf(step, byId).map((ancestor) => ({
          id: ancestor.id,
          kind: 'step' as const,
          label: this.label(ancestor, steps),
          title: ancestor.title,
          sheet: readSheet(ancestor.sheetJson)
        }))
      ],
      subtree: {
        steps: this.plan(below, steps),
        documents: this.port.documents(new Set([step.id])),
        deliverable: final?.files ?? []
      }
    }
  }

  /** Étapes dans l'ordre de lecture de l'arbre (1, 1.1, 1.2, 2…), avec leur rang et leur éventuelle action finale. */
  private plan(steps: readonly StepRow[], all: readonly StepRow[] = steps): PlanStepData[] {
    return inTreeOrder(steps).map((step) => {
      const final = this.port.final(step.id)
      return {
        id: step.id,
        parentId: step.parentId,
        label: this.label(step, all),
        title: step.title,
        status: step.status,
        ...(final === null ? {} : { final: { deliverable: final.deliverable, state: final.state } })
      }
    })
  }
}
