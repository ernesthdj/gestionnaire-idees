import { createHash, randomUUID } from 'node:crypto'
import { BLOCK_DEFAULT_SIZES, RESULT_GAP } from '@shared/ipc/canvas'
import type { HatchedResultView, TreeView } from '@shared/ipc/neurons'
import {
  IDEA_PARTS,
  STEP_PARTS,
  type IdeaPart,
  type InputPart,
  type InputSourceKind,
  type IoLinkView,
  type StepPart,
  type WidgetEmitView,
  type WidgetInputData,
  type WidgetInputsView,
  type WidgetIoStateView,
  type WidgetResultView
} from '@shared/ipc/widgetIo'
import { AppError } from '../../domain/errors'
import { checkResult } from '../../domain/widgets/resultLimits'
import { shapeOf } from '../../domain/widgets/shape'
import type { BlockRepository } from '../../infrastructure/db/repositories/BlockRepository'
import type { WidgetInputRow, WidgetIoRepository } from '../../infrastructure/db/repositories/WidgetIoRepository'
import type { WidgetRepository, WidgetVersionRow } from '../../infrastructure/db/repositories/WidgetRepository'
import { defaultParts, partsFor } from '../../domain/widgets/inputParts'
import { EMPTY_SHEET } from '../../domain/conversation/sheet'
import { assembleIdea, assembleLegacyStep, assemblePlanStep, type IdeaFacts } from './InputAssembler'
import { PlanFacts, type PlanContextPort } from './PlanFacts'

export interface WidgetIoDependencies {
  readonly repository: WidgetIoRepository
  readonly widgets: Pick<WidgetRepository, 'widget' | 'version'>
  /** Blocs de la carte : place du widget, et son cadre résultat (créé à la première émission). */
  readonly blocks: Pick<BlockRepository, 'get' | 'insert' | 'resultBlockOf'>
  /** Idée et son arbre en cours ; `undefined` si elle n'existe plus. */
  readonly tree: (rootId: string) => TreeView | undefined
  /** Ancien document éclos (archive), pour les anciennes « prochaines étapes » branchées. */
  readonly document: (rootId: string) => HatchedResultView | null
  /** Plans, fiches et annexes (spec 015) ; absent : une idée ne transmet que son identité, aucune étape n'est branchable. */
  readonly context?: PlanContextPort
}

/**
 * Empreinte de ce qu'une autorisation couvre (spec 005 FR-002) : le code de la version ET la liste exacte de ce
 * qu'elle lit. Changer le code, brancher une autre source ou cocher une partie de plus redemande la revue.
 */
export function ioFingerprint(version: WidgetVersionRow, inputs: readonly WidgetInputRow[]): string {
  const capabilities = inputs
    .map((input) => `${input.sourceKind}:${input.sourceId}:${[...input.parts].sort().join(',')}`)
    .sort()
  return createHash('sha256')
    .update(JSON.stringify([version.html, version.css, version.ts, capabilities]))
    .digest('hex')
}

/**
 * Entrées et sorties des widgets (spec 005, 015) : brancher une idée ou une étape de plan, autoriser une version figée
 * à les lire, lui remettre ces données — et seulement elles — puis recevoir le résultat qu'elle publie. C'est ici,
 * dans le main, que se décide ce qu'un widget reçoit et ce qui est gardé de lui : l'interface et le cadre isolé ne
 * font que relayer.
 */
export class WidgetIoService {
  private readonly plans: PlanFacts | undefined

  constructor(private readonly deps: WidgetIoDependencies) {
    this.plans =
      deps.context === undefined
        ? undefined
        : new PlanFacts(deps.context, (rootId) => this.liveTree(rootId) !== undefined)
  }

  connect(input: {
    readonly blockId: string
    readonly sourceKind: InputSourceKind
    readonly sourceId: string
  }): WidgetIoStateView {
    const { repository } = this.deps
    this.widgetOrThrow(input.blockId)
    if (input.sourceKind === 'step') {
      throw new AppError('VALIDATION', 'Ancienne source : branche plutôt une étape du plan d’attaque')
    }
    if (input.sourceKind === 'idea' && this.liveTree(input.sourceId) === undefined) {
      throw new AppError('NOT_FOUND', 'Idée introuvable')
    }
    if (input.sourceKind === 'plan_step' && this.plans?.liveStep(input.sourceId) === undefined) {
      throw new AppError('NOT_FOUND', 'Étape introuvable')
    }
    const already = repository
      .inputs(input.blockId)
      .some((entry) => entry.sourceKind === input.sourceKind && entry.sourceId === input.sourceId)
    if (already) throw new AppError('DUPLICATE', 'Cette source est déjà branchée sur ce widget')
    repository.insertInput({ ...input, parts: defaultParts(input.sourceKind) })
    return this.state(input.blockId)
  }

  /** Parties transmises par ce branchement ; les changer redemande l'autorisation. */
  setParts(input: { readonly inputId: string; readonly parts: readonly InputPart[] }): WidgetIoStateView {
    const row = this.inputOrThrow(input.inputId)
    if (row.sourceKind === 'step') throw new AppError('VALIDATION', 'Une ancienne prochaine étape n’a pas de parties')
    this.deps.repository.setParts(row.id, partsFor(row.sourceKind, input.parts))
    return this.state(row.blockId)
  }

  /** Débranche une source (annulable depuis l'Historique). */
  disconnect(inputId: string): { readonly batchId: string; readonly blockId: string } {
    const { repository } = this.deps
    const row = this.inputOrThrow(inputId)
    const batchId = randomUUID()
    repository.transaction(() => {
      repository.softDelete(row.id)
      repository.log(batchId, [
        {
          kind: 'delete',
          entity: 'widget_input',
          entityId: row.id,
          before: { sourceKind: row.sourceKind },
          after: null
        }
      ])
    })
    return { batchId, blockId: row.blockId }
  }

  state(blockId: string): WidgetIoStateView {
    const widget = this.widgetOrThrow(blockId)
    const inputs = this.deps.repository.inputs(blockId)
    const version = widget.versionId === null ? undefined : this.deps.widgets.version(blockId, widget.versionId)
    return {
      blockId,
      inputs: inputs.map((input) => ({
        id: input.id,
        blockId,
        sourceKind: input.sourceKind,
        sourceId: input.sourceId,
        ...this.sourceTitle(input.sourceKind, input.sourceId),
        parts: input.parts
      })),
      approved:
        version !== undefined &&
        inputs.length > 0 &&
        this.deps.repository.isApproved(blockId, ioFingerprint(version, inputs))
    }
  }

  /** L'utilisateur a relu le code et ce qu'il lit : la version affichée est autorisée pour ces entrées. */
  approve(blockId: string): WidgetIoStateView {
    const widget = this.widgetOrThrow(blockId)
    const version = widget.versionId === null ? undefined : this.deps.widgets.version(blockId, widget.versionId)
    if (version === undefined) throw new AppError('INVALID_STATE', 'Ce widget n’a pas encore de code à autoriser')
    const inputs = this.deps.repository.inputs(blockId)
    if (inputs.length === 0) throw new AppError('INVALID_STATE', 'Rien n’est branché sur ce widget')
    this.deps.repository.approve(blockId, ioFingerprint(version, inputs))
    return this.state(blockId)
  }

  /** Données remises à une version : rien si elle n'est pas autorisée pour exactement ces entrées. */
  inputs(input: { readonly blockId: string; readonly versionId: string }): WidgetInputsView {
    this.widgetOrThrow(input.blockId)
    const version = this.deps.widgets.version(input.blockId, input.versionId)
    if (version === undefined) throw new AppError('NOT_FOUND', 'Version introuvable')
    const rows = this.deps.repository.inputs(input.blockId)
    if (rows.length === 0) return { approved: true, inputs: [] }
    if (!this.deps.repository.isApproved(input.blockId, ioFingerprint(version, rows))) {
      return { approved: false, inputs: [] }
    }
    return { approved: true, inputs: this.assemble(rows) }
  }

  /**
   * Résultat publié par la version affichée (FR-005, FR-006) : vérifié, gardé comme dernier résultat, et affiché
   * dans le cadre résultat du widget — créé à sa droite à la première émission, recréé s'il a été supprimé.
   */
  emit(input: { readonly blockId: string; readonly versionId: string; readonly data: unknown }): WidgetEmitView {
    const { repository, blocks } = this.deps
    const widget = this.widgetOrThrow(input.blockId)
    if (widget.versionId !== input.versionId) {
      throw new AppError('INVALID_STATE', 'Ce résultat vient d’une version qui n’est plus affichée')
    }
    const check = checkResult(input.data)
    if (!check.ok) throw new AppError('VALIDATION', check.reason)
    return repository.transaction((): WidgetEmitView => {
      repository.saveResult(input.blockId, check.json)
      const existing = blocks.resultBlockOf(input.blockId)
      if (existing !== undefined) return { resultBlockId: existing.id, created: false }
      const source = blocks.get(input.blockId)
      if (source === undefined) throw new AppError('NOT_FOUND', 'Widget introuvable')
      const size = BLOCK_DEFAULT_SIZES.result
      const created = blocks.insert({
        kind: 'result',
        x: source.x + source.width / 2 + RESULT_GAP + size.width / 2,
        y: source.y,
        ...size,
        text: null,
        sourceBlockId: input.blockId
      })
      return { resultBlockId: created.id, created: true }
    })
  }

  /** Ce qu'affiche un cadre résultat : le dernier résultat de son widget, rien d'autre. */
  result(resultBlockId: string): WidgetResultView {
    const frame = this.deps.blocks.get(resultBlockId)
    if (frame === undefined || frame.kind !== 'result' || frame.sourceBlockId === null) {
      throw new AppError('NOT_FOUND', 'Cadre résultat introuvable')
    }
    const widget = this.widgetOrThrow(frame.sourceBlockId)
    const row = this.deps.repository.result(frame.sourceBlockId)
    if (row === undefined) throw new AppError('NOT_FOUND', 'Ce widget n’a pas encore publié de résultat')
    const version =
      widget.versionId === null ? undefined : this.deps.widgets.version(frame.sourceBlockId, widget.versionId)
    const data: unknown = JSON.parse(row.dataJson)
    return {
      blockId: frame.id,
      widgetBlockId: frame.sourceBlockId,
      widgetTitle: version?.title ?? null,
      data,
      updatedAt: row.updatedAt
    }
  }

  /** Structure des entrées branchées (sans aucune valeur), décrite à Claude quand il fait évoluer le widget. */
  inputShape(blockId: string): string | null {
    const rows = this.deps.repository.inputs(blockId)
    return rows.length === 0 ? null : shapeOf(this.assemble(rows))
  }

  /** Traits de la carte : branchements dont la source existe encore. */
  links(): IoLinkView[] {
    return this.deps.repository.links().map(({ id, blockId, sourceKind, sourceId }) => ({
      id,
      blockId,
      sourceKind,
      sourceId
    }))
  }

  private assemble(rows: readonly WidgetInputRow[]): WidgetInputData[] {
    return rows.flatMap((row): WidgetInputData[] => {
      // Source disparue (idée ou étape retirée) : entrée vide, sans erreur.
      if (row.sourceKind === 'plan_step') {
        const facts = this.plans?.step(row.sourceId)
        return facts === undefined ? [] : [assemblePlanStep(facts, row.parts.filter(isStepPart))]
      }
      const tree = this.liveTree(row.sourceId)
      if (tree === undefined) return []
      if (row.sourceKind === 'idea') return [assembleIdea(this.ideaFacts(tree), row.parts.filter(isIdeaPart))]
      const legacy = assembleLegacyStep(tree.root, this.deps.document(row.sourceId))
      return legacy === null ? [] : [legacy]
    })
  }

  /** Titre et rang affichés par la revue ; `null` si la source a disparu. */
  private sourceTitle(
    kind: InputSourceKind,
    id: string
  ): { readonly title: string | null; readonly label: string | null } {
    if (kind !== 'plan_step') return { title: this.liveTree(id)?.root.title ?? null, label: null }
    const step = this.plans?.liveStep(id)
    return step === undefined || this.plans === undefined
      ? { title: null, label: null }
      : { title: step.title, label: this.plans.displayLabel(step) }
  }

  private ideaFacts(tree: TreeView): IdeaFacts {
    const { root } = tree
    return {
      id: root.id,
      title: root.title,
      nature: root.nature,
      category: root.category?.label ?? null,
      state: root.state,
      originalText: root.content ?? root.title,
      ...(this.plans?.idea(root) ?? { sheet: EMPTY_SHEET, plan: [], documents: [] })
    }
  }

  /** Idée encore sur la carte : une idée supprimée (archivée) ne transmet plus rien. */
  private liveTree(rootId: string): TreeView | undefined {
    const tree = this.deps.tree(rootId)
    return tree === undefined || tree.root.state === 'archived' ? undefined : tree
  }

  private widgetOrThrow(blockId: string): { readonly versionId: string | null } {
    const widget = this.deps.widgets.widget(blockId)
    if (widget === undefined) throw new AppError('NOT_FOUND', 'Widget introuvable')
    return widget
  }

  private inputOrThrow(inputId: string): WidgetInputRow {
    const row = this.deps.repository.input(inputId)
    if (row === undefined) throw new AppError('NOT_FOUND', 'Branchement introuvable')
    return row
  }
}

const isIdeaPart = (part: InputPart): part is IdeaPart => (IDEA_PARTS as readonly string[]).includes(part)
const isStepPart = (part: InputPart): part is StepPart => (STEP_PARTS as readonly string[]).includes(part)
