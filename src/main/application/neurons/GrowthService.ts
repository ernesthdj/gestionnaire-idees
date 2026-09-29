import { EtendreOut, type Extension } from '@shared/ai/neurons'
import type { TreeView } from '@shared/ipc/neurons'
import { MAX_WEB_SEARCHES } from '../../domain/ai/routing'
import type { AIErrorCode } from '../../domain/ai/types'
import { AppError } from '../../domain/errors'
import {
  applyGaugeFloor,
  filterNewExtensions,
  filterNewSuggestions,
  MAX_AI_DEPTH,
  MIN_EXTENSIONS
} from '../../domain/neurons/guards'
import { aliasesOf, descendantsOf } from '../../domain/neurons/tree'
import type { GrowthRepository } from '../../infrastructure/db/repositories/GrowthRepository'
import type { AIGateway } from '../ai/AIGateway'
import { buildGrowthInput, type ExtensionMode } from './GrowthContextBuilder'
import type { NeuronService } from './NeuronService'

export type GrowthEvent =
  | { readonly type: 'neuron:created'; readonly rootId: string; readonly neuronId: string }
  | { readonly type: 'neuron:thinking'; readonly rootId: string; readonly neuronId: string }
  | { readonly type: 'neuron:thought'; readonly rootId: string }
  | { readonly type: 'suggestion:updated'; readonly rootId: string; readonly suggestionId: string }

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
/** Réponse de la recherche web conservée sur le fantôme (2 à 3 phrases attendues). */
const RESEARCH_MAX = 800

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
  private readonly inFlight = new Set<Promise<void>>()

  constructor(private readonly deps: GrowthDependencies) {}

  /** Attend la fin des vérifications web en cours (tests, arrêt propre). */
  async settled(): Promise<void> {
    await Promise.all([...this.inFlight])
  }

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

  /**
   * Suggestion acceptée : elle devient un sous-neurone « proposé par l'IA, validé par l'utilisateur »,
   * puis l'idée continue de grandir comme après une réponse.
   */
  async acceptSuggestion(suggestionId: string): Promise<GrowthResult> {
    const { repository } = this.deps
    const suggestion = repository.suggestion(suggestionId)
    if (suggestion === undefined) throw new AppError('NOT_FOUND', 'Suggestion introuvable')
    if (suggestion.status !== 'proposed') throw new AppError('INVALID_STATE', 'Cette suggestion n’est plus proposée')
    const parent = repository.node(suggestion.neuronId)
    if (parent === undefined) throw new AppError('NOT_FOUND', 'Neurone introuvable')

    const neuronId = repository.transaction(() => {
      const id = repository.insertSubNeuron({
        rootId: suggestion.rootId,
        parentId: parent.id,
        depth: parent.depth + 1,
        // Une suggestion acceptée reste une « idée » (forme propre sur la carte, fiche au double-clic).
        kind: 'idea',
        title: suggestion.title.slice(0, TITLE_MAX),
        content: suggestion.content,
        origin: 'ai',
        fromExtensionId: null
      })
      repository.resolveSuggestion(suggestion.id, 'accepted', id)
      repository.touchRoot(suggestion.rootId)
      return id
    })
    this.deps.emit({ type: 'neuron:created', rootId: suggestion.rootId, neuronId })
    const mode: ExtensionMode = parent.depth + 1 >= MAX_AI_DEPTH ? 'assess_only' : 'follow_up'
    return this.extend(suggestion.rootId, neuronId, mode)
  }

  dismissSuggestion(suggestionId: string): GrowthResult {
    const suggestion = this.deps.repository.suggestion(suggestionId)
    if (suggestion === undefined) throw new AppError('NOT_FOUND', 'Suggestion introuvable')
    if (suggestion.status !== 'proposed') throw new AppError('INVALID_STATE', 'Cette suggestion n’est plus proposée')
    this.deps.repository.resolveSuggestion(suggestionId, 'dismissed')
    return { tree: this.tree(suggestion.rootId) }
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

  /** Modifie un sous-neurone (FR-016) ; la version de l'idée augmente, une synthèse proposée devient périmée. */
  editBranch(input: {
    readonly neuronId: string
    readonly title: string
    readonly content?: string | null
  }): GrowthResult {
    const { repository } = this.deps
    const node = repository.node(input.neuronId)
    if (node === undefined) throw new AppError('NOT_FOUND', 'Neurone introuvable')
    if (node.kind === 'root') throw new AppError('IS_ROOT', 'Pour l’idée elle-même, modifie son titre depuis la carte')
    repository.transaction(() => {
      repository.updateSubNeuron(node.id, {
        title: input.title.trim().slice(0, TITLE_MAX),
        content: input.content === undefined ? node.content : input.content
      })
      repository.touchRoot(node.rootId)
    })
    return { tree: this.tree(node.rootId) }
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
  /** « L'IA réfléchit » se termine toujours, même sur une erreur inattendue : l'interface n'est jamais bloquée. */
  private async extend(rootId: string, targetId: string, mode: ExtensionMode): Promise<GrowthResult> {
    try {
      return await this.grow(rootId, targetId, mode)
    } catch (error) {
      this.deps.emit({ type: 'neuron:thought', rootId })
      throw error
    }
  }

  private async grow(rootId: string, targetId: string, mode: ExtensionMode): Promise<GrowthResult> {
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
          knownSuggestions: repository.knownSuggestions(rootId),
          answered: repository.answeredCount(rootId),
          mode
        })
      })

    let result = await attempt()
    if (!result.ok) return this.finish(rootId, { code: result.error.code, message: result.error.message })
    // « Hors sujet » n'est retenu que sans aucune question, et jamais du modèle local de repli : il le déclare à tort
    // pour des idées ordinaires (3 fois sur 5 au banc d'essai du 2026-09-29).
    const outOfScope =
      result.value.data.kind === 'out_of_scope' && result.value.data.extensions.length === 0 && !result.value.degraded
    if (outOfScope) {
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
    const nodes = repository.nodes(rootId)
    const idOf = new Map([...aliasesOf(nodes)].map(([id, alias]) => [alias, id]))
    const suggested = filterNewSuggestions(data.suggestions, new Set(idOf.keys()), [
      ...repository.knownSuggestions(rootId),
      ...nodes.map((node) => node.title)
    ])
    const suggestionIds = repository.transaction(() => {
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
      return repository.insertSuggestions(
        rootId,
        suggested.map((suggestion) => ({
          neuronId: idOf.get(suggestion.neuronRef) ?? rootId,
          title: suggestion.title,
          content: suggestion.content,
          webQuery: suggestion.research ? (suggestion.webQuery ?? null) : null
        }))
      )
    })
    suggestionIds.forEach((id, index) => {
      if (suggested[index]?.research === true) this.researchInBackground(rootId, id)
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

  /** Vérification web d'une suggestion, sans bloquer la croissance : le fantôme est mis à jour à la fin. */
  private researchInBackground(rootId: string, suggestionId: string): void {
    const { repository, gateway } = this.deps
    const suggestion = repository.suggestion(suggestionId)
    if (suggestion === undefined || suggestion.webQuery === null) return
    const input = [
      `Idée : ${this.tree(rootId).root.title}`,
      `Suggestion : ${suggestion.title} — ${suggestion.content}`,
      `Recherche proposée : ${suggestion.webQuery}`
    ].join('\n')
    const task = gateway
      .research({ input, maxSearches: MAX_WEB_SEARCHES, requestId: `research:${suggestionId}` })
      .then((result) => {
        repository.completeResearch(
          suggestionId,
          result.ok ? { content: result.value.text.slice(0, RESEARCH_MAX), sources: result.value.sources } : null
        )
      })
      .catch(() => repository.completeResearch(suggestionId, null))
      .then(() => this.deps.emit({ type: 'suggestion:updated', rootId, suggestionId }))
      .catch(() => undefined)
      .finally(() => this.inFlight.delete(task))
    this.inFlight.add(task)
  }

  private finish(rootId: string, notice?: GrowthNotice): GrowthResult {
    this.deps.emit({ type: 'neuron:thought', rootId })
    return notice === undefined ? { tree: this.tree(rootId) } : { tree: this.tree(rootId), notice }
  }
}
