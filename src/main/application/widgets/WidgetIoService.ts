import { createHash, randomUUID } from 'node:crypto'
import type { HatchedResultView, TreeView } from '@shared/ipc/neurons'
import {
  IDEA_PARTS,
  type IdeaPart,
  type InputSourceKind,
  type IoLinkView,
  type WidgetInputData,
  type WidgetInputsView,
  type WidgetIoStateView
} from '@shared/ipc/widgetIo'
import { AppError } from '../../domain/errors'
import { shapeOf } from '../../domain/widgets/shape'
import type { WidgetInputRow, WidgetIoRepository } from '../../infrastructure/db/repositories/WidgetIoRepository'
import type { WidgetRepository, WidgetVersionRow } from '../../infrastructure/db/repositories/WidgetRepository'
import { assembleIdea, assembleStep, type IdeaFacts } from './InputAssembler'

export interface WidgetIoDependencies {
  readonly repository: WidgetIoRepository
  readonly widgets: Pick<WidgetRepository, 'widget' | 'version'>
  /** Idée et son arbre en cours ; `undefined` si elle n'existe plus. */
  readonly tree: (rootId: string) => TreeView | undefined
  readonly document: (rootId: string) => HatchedResultView | null
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
 * Entrées des widgets (spec 005 lot 1) : brancher une idée ou une prochaine étape, autoriser une version figée à
 * les lire, puis lui remettre ces données — et seulement elles. C'est ici, dans le main, que se décide ce qu'un
 * widget reçoit : l'interface et le cadre isolé ne font que relayer.
 */
export class WidgetIoService {
  constructor(private readonly deps: WidgetIoDependencies) {}

  connect(input: {
    readonly blockId: string
    readonly sourceKind: InputSourceKind
    readonly sourceId: string
  }): WidgetIoStateView {
    const { repository } = this.deps
    this.widgetOrThrow(input.blockId)
    const facts = this.facts(input.sourceId)
    if (facts === undefined) throw new AppError('NOT_FOUND', 'Idée introuvable')
    if (input.sourceKind === 'step' && assembleStep(facts) === null) {
      throw new AppError('NOT_FOUND', 'Cette idée n’a pas de prochaine étape')
    }
    const already = repository
      .inputs(input.blockId)
      .some((entry) => entry.sourceKind === input.sourceKind && entry.sourceId === input.sourceId)
    if (already) throw new AppError('DUPLICATE', 'Cette source est déjà branchée sur ce widget')
    repository.insertInput({ ...input, parts: input.sourceKind === 'idea' ? [...IDEA_PARTS] : [] })
    return this.state(input.blockId)
  }

  /** Parties d'une idée transmises par ce branchement ; les changer redemande l'autorisation. */
  setParts(input: { readonly inputId: string; readonly parts: readonly IdeaPart[] }): WidgetIoStateView {
    const row = this.inputOrThrow(input.inputId)
    if (row.sourceKind !== 'idea') throw new AppError('VALIDATION', 'Une prochaine étape n’a pas de parties')
    this.deps.repository.setParts(
      row.id,
      IDEA_PARTS.filter((part) => input.parts.includes(part))
    )
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
        title: this.liveTree(input.sourceId)?.root.title ?? null,
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
      const facts = this.facts(row.sourceId)
      // Source disparue (idée supprimée, étape absente du nouveau document) : entrée vide, sans erreur.
      if (facts === undefined) return []
      if (row.sourceKind === 'idea') return [assembleIdea(facts, row.parts)]
      const step = assembleStep(facts)
      return step === null ? [] : [step]
    })
  }

  /** Idée encore sur la carte : une idée supprimée (archivée) ne transmet plus rien. */
  private liveTree(rootId: string): TreeView | undefined {
    const tree = this.deps.tree(rootId)
    return tree === undefined || tree.root.state === 'archived' ? undefined : tree
  }

  private facts(rootId: string): IdeaFacts | undefined {
    const tree = this.liveTree(rootId)
    return tree === undefined
      ? undefined
      : { tree, answers: this.deps.repository.answers(rootId), document: this.deps.document(rootId) }
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
