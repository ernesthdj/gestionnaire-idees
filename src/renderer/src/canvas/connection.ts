import type { IdeasCanvasView } from '@shared/ipc/canvas'

/** Ce que devient un lien tiré sur la carte. */
export type ConnectionIntent =
  | {
      readonly kind: 'input'
      readonly blockId: string
      readonly sourceKind: 'idea' | 'plan_step' | 'element' | 'workflow'
      readonly sourceId: string
    }
  | { readonly kind: 'link'; readonly from: string; readonly to: string }
  | null

/**
 * Lien tiré d'un nœud vers un autre (FR-031, spec 005, spec 015, spec 023 D24) : vers un widget, la source devient une
 * entrée (idée, étape de plan, élément de structure, nœud du Workflow) ; d'une idée vers une idée, un lien libre ; une
 * étape, un élément ou un nœud Workflow ne se tire que vers un widget.
 */
export function connectionIntent(
  view: Pick<IdeasCanvasView, 'blocks' | 'steps' | 'elements'> | undefined,
  source: string,
  target: string
): ConnectionIntent {
  if (view === undefined || source === target) return null
  const sourceKind = view.steps.some((step) => step.id === source)
    ? 'plan_step'
    : view.elements.some((element) => element.id === source)
      ? 'element'
      : source.startsWith('wf:')
        ? 'workflow'
        : 'idea'
  if (view.blocks.some((block) => block.id === target && block.kind === 'widget')) {
    return { kind: 'input', blockId: target, sourceKind, sourceId: source }
  }
  return sourceKind === 'idea' ? { kind: 'link', from: source, to: target } : null
}
