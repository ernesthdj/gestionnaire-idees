import type { StructureView } from '@shared/brainstorms/viewState'
import { randomUUID } from 'node:crypto'
import { AppError } from '../../domain/errors'
import { checkDependencies, renumber, type DependencyProblem } from '../../domain/plan/dependencies'
import type { ChangeEntry } from '../../infrastructure/db/repositories/changeLog'
import {
  normalizeTitle,
  type PlanNodeRow,
  type PlanRepository,
  type StepRow
} from '../../infrastructure/db/repositories/PlanRepository'

/** Bornes d'un plan lisible (spec 011, Edge Cases). */
export const PLAN_LIMITS = { stepsPerLayer: 12, depth: 4 } as const

export interface ProposedStep {
  /** Clé locale : sert aux dépendances internes à la proposition. */
  readonly key: string
  readonly title: string
  readonly why: string
  /** Clés de cette proposition, ou identifiants d'étapes sœurs existantes. */
  readonly waitsFor?: readonly string[]
}

export interface PlanDeps {
  readonly repository: Pick<
    PlanRepository,
    | 'transaction'
    | 'log'
    | 'node'
    | 'children'
    | 'insertStep'
    | 'setArchived'
    | 'setRank'
    | 'setOffset'
    | 'setFolded'
    | 'addDependency'
    | 'removeDependency'
    | 'dependenciesTouching'
    | 'setLock'
    | 'createProposal'
    | 'proposal'
    | 'refusedTitles'
    | 'decideItem'
    | 'closeIfDecided'
  >
  /** Actions finales (spec 013) : une action acceptée est une feuille, jamais découpée. */
  readonly finals?: { isFinal(neuronId: string): boolean }
  readonly now?: () => Date
  /**
   * Vue affichée de la carte d'un genesis (spec 023 D19) : une étape née sous le genesis y est rangée ; `null` : pas
   * de vue (genesis sans projet lié ni carte).
   */
  readonly structureView?: (genesisId: string) => StructureView | null
}

const PROBLEMS: Readonly<Record<DependencyProblem, string>> = {
  CYCLE: 'Ces dépendances forment une boucle : une étape ne peut pas s’attendre elle-même.',
  OUTSIDE: 'Une étape ne peut attendre que ses sœurs (même parent).',
  ORDER: 'Une étape est placée avant une étape qu’elle attend : range-les dans l’ordre.'
}

/**
 * Plan d'attaque (spec 011) : Claude propose une couche d'étapes (fantômes, hors des données de mentalyas) ;
 * mentalyas décide ; accepter verrouille le parent (D6) et fait naître les étapes, en un lot d'Historique annulable.
 */
export class PlanService {
  constructor(private readonly deps: PlanDeps) {}

  propose(input: { readonly parentId: string; readonly steps: readonly ProposedStep[] }): {
    readonly proposalId: string
    readonly count: number
  } {
    const { repository } = this.deps
    const parent = repository.node(input.parentId)
    if (parent === undefined) throw new AppError('NOT_FOUND', 'Nœud introuvable')
    if (this.deps.finals?.isFinal(parent.id) === true) {
      throw new AppError(
        'VALIDATION',
        'Cette étape est une action finale : elle ne se découpe plus (mentalyas peut la rétrograder).'
      )
    }
    this.refuseWorkflow(parent)
    if (parent.depth + 1 > PLAN_LIMITS.depth) {
      throw new AppError('VALIDATION', `Au plus ${PLAN_LIMITS.depth} niveaux sous le genesis : regroupe plutôt.`)
    }
    if (input.steps.length === 0 || input.steps.length > PLAN_LIMITS.stepsPerLayer) {
      throw new AppError('VALIDATION', `Une couche compte de 1 à ${PLAN_LIMITS.stepsPerLayer} étapes : regroupe.`)
    }
    if (new Set(input.steps.map((step) => step.key)).size !== input.steps.length) {
      throw new AppError('VALIDATION', 'Chaque étape proposée a une clé différente.')
    }
    const refused = repository.refusedTitles(parent.id)
    const kept = input.steps.filter((step) => !refused.has(normalizeTitle(step.title)))
    if (kept.length === 0) {
      throw new AppError('VALIDATION', 'mentalyas a déjà refusé ces étapes pour ce nœud : propose autre chose.')
    }
    const siblings = repository.children(parent.id)
    // Une dépendance vers une étape écartée parce que déjà refusée tombe avec elle.
    const dropped = new Set(input.steps.filter((step) => !kept.includes(step)).map((step) => step.key))
    const waitsOf = (step: ProposedStep): string[] => (step.waitsFor ?? []).filter((id) => !dropped.has(id))
    const problem = checkDependencies([
      ...siblings.map((sibling) => ({ id: sibling.id, rank: sibling.rank, waitsFor: sibling.waitsFor })),
      ...kept.map((step, index) => ({ id: step.key, rank: siblings.length + index + 1, waitsFor: waitsOf(step) }))
    ])
    if (problem !== null) throw new AppError('VALIDATION', PROBLEMS[problem])

    const proposalId = randomUUID()
    repository.transaction(() =>
      repository.createProposal(
        proposalId,
        parent.id,
        kept.map((step, index) => ({
          id: randomUUID(),
          key: step.key,
          title: step.title.trim(),
          why: step.why.trim(),
          rank: index + 1,
          waitsFor: waitsOf(step)
        }))
      )
    )
    return { proposalId, count: kept.length }
  }

  decide(input: {
    readonly proposalId: string
    readonly accept: readonly string[]
    readonly reject: readonly string[]
  }): {
    readonly batchId: string | null
    readonly born: readonly string[]
  } {
    const { repository } = this.deps
    const proposal = repository.proposal(input.proposalId)
    if (proposal === undefined) throw new AppError('NOT_FOUND', 'Proposition introuvable')
    if (proposal.status !== 'en_attente') throw new AppError('INVALID_STATE', 'Cette proposition n’est plus en attente')
    const pending = new Map(
      proposal.items.filter((item) => item.status === 'en_attente').map((item) => [item.id, item] as const)
    )
    if ([...input.accept, ...input.reject].some((id) => !pending.has(id))) {
      throw new AppError('INVALID_STATE', 'Une de ces étapes n’est plus proposée')
    }
    const parent = repository.node(proposal.parentId)
    if (parent === undefined) throw new AppError('NOT_FOUND', 'Nœud introuvable')
    const accepted = proposal.items.filter((item) => input.accept.includes(item.id))
    if (accepted.length > 0) this.refuseWorkflow(parent)
    const view = this.birthView(parent)

    const batchId = randomUUID()
    const born: string[] = []
    repository.transaction(() => {
      const entries: ChangeEntry[] = []
      const entry = (entity: string, entityId: string, before: unknown, after: unknown): void => {
        entries.push({ kind: 'plan', entity, entityId, before, after })
      }
      if (accepted.length > 0 && parent.lockedAt === null) {
        // D6 : les sous-nœuds naissent toujours sur un contexte figé.
        repository.setLock(parent.id, this.now())
        entry('neuron_lock', parent.id, { locked: false }, { locked: true })
      }
      let rank = repository.children(parent.id).length
      const bornByKey = new Map<string, string>()
      for (const item of accepted) {
        const id = randomUUID()
        rank += 1
        repository.insertStep({
          id,
          genesisId: parent.genesisId,
          parentId: parent.id,
          depth: parent.depth + 1,
          rank,
          title: item.title,
          content: item.why,
          view
        })
        entry('step', id, null, { title: item.title, parentId: parent.id })
        repository.decideItem(item.id, 'valide', id)
        bornByKey.set(item.key, id)
        born.push(id)
      }
      for (const item of accepted) {
        const stepId = bornByKey.get(item.key) ?? ''
        for (const target of item.waitsFor) {
          // Clé d'une étape de la proposition (née seulement si acceptée), ou étape sœur existante.
          const waitsForId =
            bornByKey.get(target) ?? (proposal.items.some((other) => other.key === target) ? null : target)
          if (waitsForId === null) continue
          repository.addDependency(stepId, waitsForId)
          entry('step_dependency', `${stepId}>${waitsForId}`, null, { waitsFor: waitsForId })
        }
      }
      for (const id of input.reject) repository.decideItem(id, 'refuse')
      repository.closeIfDecided(proposal.id)
      repository.log(batchId, entries)
    })
    return { batchId: born.length > 0 ? batchId : null, born }
  }

  /** Étape glissée par mentalyas : sa branche suit (décalage relatif à sa place calculée, non historisé). */
  /** Vue de naissance (spec 023 D19) : celle affichée pour une étape du genesis, celle de son parent sinon. */
  private birthView(parent: PlanNodeRow): StructureView | null {
    return parent.kind === 'step'
      ? (this.deps.repository.children(parent.parentId ?? '').find((step) => step.id === parent.id)?.view ?? null)
      : (this.deps.structureView?.(parent.genesisId) ?? null)
  }

  /** La vue Workflow se lit dans les fichiers du projet (spec 023 D22) : aucune étape n'y naît. */
  private refuseWorkflow(parent: PlanNodeRow): void {
    if (this.birthView(parent) !== 'workflow') return
    throw new AppError(
      'VALIDATION',
      'La vue Workflow se lit dans les fichiers du projet : ajoute ces tâches dans son fichier de tâches ' +
        '(cases « - [ ] », ou tasks.md d’une spec) au lieu de créer des étapes.'
    )
  }

  move(stepId: string, x: number, y: number): void {
    if (!this.isStep(stepId)) throw new AppError('NOT_FOUND', 'Étape introuvable')
    this.deps.repository.setOffset(stepId, x, y)
  }

  /** Replie ou déplie les sous-étapes d'une étape, ou tout le plan d'un genesis (spec 022 D14, non historisé). */
  setFolded(id: string, folded: boolean): void {
    if (this.deps.repository.node(id) === undefined) throw new AppError('NOT_FOUND', 'Étape introuvable')
    this.deps.repository.setFolded(id, folded)
  }

  isStep(id: string): boolean {
    return this.deps.repository.node(id)?.kind === 'step'
  }

  /** Retire une étape et ses descendants (archivage), renumérote ses sœurs, retire ses dépendances ; annulable. */
  remove(stepId: string): { readonly batchId: string } {
    return this.removeMany([stepId])
  }

  /**
   * Retire plusieurs étapes et leurs descendants en un seul lot d'Historique (spec 023 D23 : étapes nées dans la vue
   * Workflow avant qu'elle ne se lise que dans les fichiers) ; annulable d'un geste.
   */
  removeMany(stepIds: readonly string[]): { readonly batchId: string } {
    const { repository } = this.deps
    for (const stepId of stepIds) {
      const step = repository.node(stepId)
      if (step === undefined || step.kind !== 'step' || step.parentId === null) {
        throw new AppError('NOT_FOUND', 'Étape introuvable')
      }
    }
    const batchId = randomUUID()
    repository.transaction(() => {
      const entries: ChangeEntry[] = []
      const entry = (entity: string, entityId: string, before: unknown, after: unknown): void => {
        entries.push({ kind: 'delete', entity, entityId, before, after })
      }
      const archived = new Set<string>()
      for (const stepId of stepIds) {
        const parentId = repository.node(stepId)?.parentId
        if (archived.has(stepId) || parentId === null || parentId === undefined) continue
        const removed: StepRow[] = []
        const collect = (id: string): void => {
          for (const child of repository.children(id)) {
            collect(child.id)
            removed.push(child)
          }
        }
        collect(stepId)
        const siblings = repository.children(parentId)
        const self = siblings.find((sibling) => sibling.id === stepId)
        if (self !== undefined) removed.push(self)
        const gone = new Set(removed.map((row) => row.id))
        for (const row of removed) {
          for (const dependency of repository.dependenciesTouching(row.id)) {
            const key = `${dependency.stepId}>${dependency.waitsForId}`
            if (entries.some((existing) => existing.entityId === key)) continue
            repository.removeDependency(dependency.stepId, dependency.waitsForId)
            entry('step_dependency', key, { waitsFor: dependency.waitsForId }, null)
          }
        }
        for (const row of removed) {
          repository.setArchived(row.id, true)
          archived.add(row.id)
          entry('step', row.id, { title: row.title, parentId: row.parentId }, null)
        }
        const before = new Map(siblings.map((sibling) => [sibling.id, sibling.rank] as const))
        for (const sibling of renumber(siblings.filter((row) => !gone.has(row.id)))) {
          if (before.get(sibling.id) === sibling.rank) continue
          repository.setRank(sibling.id, sibling.rank)
          entry('step_rank', sibling.id, { rank: before.get(sibling.id) ?? null }, { rank: sibling.rank })
        }
      }
      repository.log(batchId, entries)
    })
    return { batchId }
  }

  private now(): string {
    return (this.deps.now?.() ?? new Date()).toISOString()
  }
}
