import { EtendreOut, type Extension } from '@shared/ai/neurons'
import type { TreeView } from '@shared/ipc/neurons'
import type { AIErrorCode } from '../../domain/ai/types'
import { AppError } from '../../domain/errors'
import { applyGaugeFloor, filterNewExtensions, MAX_AI_DEPTH, MIN_EXTENSIONS } from '../../domain/neurons/guards'
import { descendantsOf } from '../../domain/neurons/tree'
import type { GrowthRepository } from '../../infrastructure/db/repositories/GrowthRepository'
import type { AIGateway } from '../ai/AIGateway'
import { buildGrowthInput, type ExtensionMode } from './GrowthContextBuilder'
import type { NeuronService } from './NeuronService'

export type GrowthEvent =
  | { readonly type: 'neuron:created'; readonly rootId: string; readonly neuronId: string }
  | { readonly type: 'neuron:thinking'; readonly rootId: string; readonly neuronId: string }
  | { readonly type: 'neuron:thought'; readonly rootId: string }

export type GrowthNoticeCode = 'FEW_EXTENSIONS' | 'OUT_OF_SCOPE' | 'DEPTH_LIMIT' | AIErrorCode

export interface GrowthNotice {
  readonly code: GrowthNoticeCode
  readonly message: string
}

export interface GrowthResult {
  readonly tree: TreeView
  readonly notice?: GrowthNotice
}

export type Answer = { readonly choice: string } | { readonly text: string } | { readonly unknown: true }

const TITLE_MAX = 120

export interface GrowthDependencies {
  readonly repository: GrowthRepository
  readonly neurons: NeuronService
  readonly gateway: AIGateway
  readonly emit: (event: GrowthEvent) => void
}

/**
 * Croissance d'un neurone (spec 002 US1) et jauge de contexte (US2) :
 * un seul appel `etendre` par réponse renvoie les nouvelles extensions ET l'évaluation du contexte (R1).
 */
export class GrowthService {
  constructor(private readonly deps: GrowthDependencies) {}

  tree(rootId: string): TreeView {
    return this.deps.neurons.getTree(rootId)
  }

  async develop(rootId: string): Promise<GrowthResult> {
    const root = this.tree(rootId).root
    if (root.state === 'archived' || root.state === 'hatched') {
      throw new AppError('INVALID_STATE', 'Cette idée ne peut pas être développée dans son état actuel')
    }
    if (root.state === 'developing' && this.deps.repository.hasProposedExtensions(rootId)) {
      return { tree: this.tree(rootId) }
    }
    this.deps.repository.touchRoot(rootId, 'developing')
    return this.extend(rootId, rootId, 'first')
  }

  async answer(input: { readonly extensionId: string; readonly answer: Answer }): Promise<GrowthResult> {
    const { repository } = this.deps
    const extension = repository.extension(input.extensionId)
    if (extension === undefined) throw new AppError('NOT_FOUND', 'Question introuvable')
    if (extension.status === 'answered') throw new AppError('ALREADY_ANSWERED', 'Cette question a déjà une réponse')
    if (extension.status === 'dismissed') throw new AppError('INVALID_STATE', 'Cette question a été écartée')
    const parent = repository.node(extension.neuronId)
    if (parent === undefined) throw new AppError('NOT_FOUND', 'Neurone introuvable')

    const value = 'unknown' in input.answer ? null : 'choice' in input.answer ? input.answer.choice : input.answer.text
    const kind = value === null ? 'investigation' : (extension.answerKind ?? 'answer')
    const title = value === null ? `À trouver : ${extension.dimension}` : `${extension.dimension} : ${value}`

    let neuronId: string
    try {
      neuronId = repository.transaction(() => {
        const id = repository.insertSubNeuron({
          rootId: extension.rootId,
          parentId: parent.id,
          depth: parent.depth + 1,
          kind,
          title: title.slice(0, TITLE_MAX),
          content: value,
          origin: 'user',
          fromExtensionId: extension.id
        })
        repository.resolveExtension(extension.id, 'answered')
        repository.touchRoot(extension.rootId)
        return id
      })
    } catch (error) {
      // Double clic concurrent : la contrainte d'unicité sur l'extension a refusé le second sous-neurone.
      if (repository.extension(input.extensionId)?.status === 'answered') {
        throw new AppError('ALREADY_ANSWERED', 'Cette question a déjà une réponse')
      }
      throw error
    }

    // Retour immédiat (SC-004) : le sous-neurone est annoncé avant l'appel à l'IA.
    this.deps.emit({ type: 'neuron:created', rootId: extension.rootId, neuronId })
    const mode: ExtensionMode = parent.depth + 1 >= MAX_AI_DEPTH ? 'assess_only' : 'follow_up'
    return this.extend(extension.rootId, neuronId, mode)
  }

  async more(neuronId: string): Promise<GrowthResult> {
    const node = this.deps.repository.node(neuronId)
    if (node === undefined) throw new AppError('NOT_FOUND', 'Neurone introuvable')
    if (node.depth >= MAX_AI_DEPTH) {
      throw new AppError('DEPTH_LIMIT', 'Branche trop profonde : crée plutôt une idée distincte et relie-les')
    }
    return this.extend(node.rootId, neuronId, 'follow_up')
  }

  dismiss(extensionId: string): GrowthResult {
    const extension = this.deps.repository.extension(extensionId)
    if (extension === undefined) throw new AppError('NOT_FOUND', 'Question introuvable')
    if (extension.status !== 'proposed') throw new AppError('INVALID_STATE', 'Cette question n’est plus proposée')
    this.deps.repository.resolveExtension(extensionId, 'dismissed')
    return { tree: this.tree(extension.rootId) }
  }

  addBranch(input: { readonly parentId: string; readonly title: string; readonly content?: string }): GrowthResult {
    const { repository } = this.deps
    const parent = repository.node(input.parentId)
    if (parent === undefined) throw new AppError('NOT_FOUND', 'Neurone introuvable')
    repository.transaction(() => {
      const id = repository.insertSubNeuron({
        rootId: parent.rootId,
        parentId: parent.id,
        depth: parent.depth + 1,
        kind: 'user_branch',
        title: input.title.trim().slice(0, TITLE_MAX),
        content: input.content ?? null,
        origin: 'user',
        fromExtensionId: null
      })
      repository.touchRoot(parent.rootId, parent.kind === 'root' ? 'developing' : undefined)
      this.deps.emit({ type: 'neuron:created', rootId: parent.rootId, neuronId: id })
    })
    return { tree: this.tree(parent.rootId) }
  }

  deleteBranch(neuronId: string): GrowthResult {
    const { repository } = this.deps
    const node = repository.node(neuronId)
    if (node === undefined) throw new AppError('NOT_FOUND', 'Neurone introuvable')
    if (node.kind === 'root') throw new AppError('IS_ROOT', 'Pour une idée entière, utilise l’archivage')
    const doomed = [node, ...descendantsOf(repository.nodes(node.rootId), node.id)].map((entry) => entry.id)
    repository.transaction(() => {
      repository.deleteNeurons(doomed)
      repository.touchRoot(node.rootId)
    })
    return { tree: this.tree(node.rootId) }
  }

  /** Appel `etendre` : extensions filtrées (E1–E3) + jauge avec plancher (E4). */
  private async extend(rootId: string, targetId: string, mode: ExtensionMode): Promise<GrowthResult> {
    const { repository } = this.deps
    this.deps.emit({ type: 'neuron:thinking', rootId, neuronId: targetId })
    const attempt = async () =>
      this.deps.gateway.run({
        kind: 'etendre',
        schema: EtendreOut,
        allowDegraded: true,
        input: buildGrowthInput({
          nature: this.tree(rootId).root.nature,
          nodes: repository.nodes(rootId),
          targetId,
          knownQuestions: repository.knownQuestions(rootId),
          answered: repository.answeredCount(rootId),
          mode
        })
      })

    let result = await attempt()
    if (!result.ok) return this.finish(rootId, { code: result.error.code, message: result.error.message })
    if (result.value.data.kind === 'out_of_scope') {
      return this.finish(rootId, {
        code: 'OUT_OF_SCOPE',
        message: result.value.data.outOfScopeMessage ?? 'Je reste un partenaire de réflexion : reformulons.'
      })
    }

    const fresh = (data: EtendreOut): Extension[] =>
      mode === 'assess_only' ? [] : filterNewExtensions(data.extensions, repository.knownQuestions(rootId))
    let kept = fresh(result.value.data)
    if (mode === 'first' && kept.length < MIN_EXTENSIONS) {
      const retry = await attempt()
      if (retry.ok && retry.value.data.kind === 'extensions') {
        const retried = fresh(retry.value.data)
        if (retried.length > kept.length) {
          result = retry
          kept = retried
        }
      }
    }

    const data = result.value.data
    repository.transaction(() => {
      repository.insertExtensions(rootId, targetId, kept)
      const answered = repository.answeredCount(rootId)
      repository.insertAssessment({
        rootId,
        level: applyGaugeFloor(data.assessment.level, answered),
        aiLevel: data.assessment.level,
        covered: data.assessment.covered,
        missing: data.assessment.missing,
        answered
      })
    })

    const notice =
      mode === 'first' && kept.length < MIN_EXTENSIONS
        ? {
            code: 'FEW_EXTENSIONS' as const,
            message: 'L’IA a peu de pistes : ajoute les tiennes avec « Ajouter ma branche ».'
          }
        : undefined
    return this.finish(rootId, notice)
  }

  private finish(rootId: string, notice?: GrowthNotice): GrowthResult {
    this.deps.emit({ type: 'neuron:thought', rootId })
    return notice === undefined ? { tree: this.tree(rootId) } : { tree: this.tree(rootId), notice }
  }
}
