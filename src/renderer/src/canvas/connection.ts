import type { IdeasCanvasView } from '@shared/ipc/canvas'

/** Ce que devient un lien tiré sur la carte. */
export type ConnectionIntent =
  | {
      readonly kind: 'input'
      readonly blockId: string
      readonly sourceKind: 'idea' | 'plan_step'
      readonly sourceId: string
    }
  | { readonly kind: 'link'; readonly from: string; readonly to: string }
  | null

/**
 * Lien tiré d'un nœud vers un autre (FR-031, spec 005, spec 015) : vers un widget, la source devient une entrée
 * (idée ou étape de plan) ; d'une idée vers une idée, un lien libre ; une étape ne se tire que vers un widget.
 */
export function connectionIntent(
  view: Pick<IdeasCanvasView, 'blocks' | 'steps'> | undefined,
  source: string,
  target: string
): ConnectionIntent {
  if (view === undefined || source === target) return null
  const isStep = view.steps.some((step) => step.id === source)
  if (view.blocks.some((block) => block.id === target && block.kind === 'widget')) {
    return { kind: 'input', blockId: target, sourceKind: isStep ? 'plan_step' : 'idea', sourceId: source }
  }
  return isStep ? null : { kind: 'link', from: source, to: target }
}
