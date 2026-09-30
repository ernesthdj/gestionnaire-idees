import { STEP_START_OFFSET, type IdeasCanvasView } from '@shared/ipc/canvas'
import type { Box } from '../../domain/widgets/placeTools'

/** Encombrement d'une idée sur la carte (la plus grande, éclose, avec sa marge) et d'une prochaine étape. */
const IDEA_BOX = 136
const STEP_BOX = { width: 240, height: 160 } as const

/**
 * Ce qui entoure une idée au moment de son éclosion (spec 006 FR-014), tiré de la vue de la carte : les idées ont
 * leur place enregistrée par l'écran Idées ; une étape jamais glissée est à sa place de départ.
 */
export function toolSurroundings(
  view: IdeasCanvasView,
  rootId: string
): { readonly idea: Box; readonly obstacles: readonly Box[] } {
  const at = view.ideas.find((idea) => idea.id === rootId)?.position ?? { x: 0, y: 0 }
  const idea: Box = { ...at, width: IDEA_BOX, height: IDEA_BOX }
  const others = view.ideas.flatMap((entry): Box[] =>
    entry.id === rootId || entry.position === null ? [] : [{ ...entry.position, width: IDEA_BOX, height: IDEA_BOX }]
  )
  const steps = view.steps.map((step): Box => {
    const root = step.rootId === rootId ? at : view.ideas.find((entry) => entry.id === step.rootId)?.position
    const place = step.position ?? { x: (root?.x ?? 0) + STEP_START_OFFSET.x, y: (root?.y ?? 0) + STEP_START_OFFSET.y }
    return { ...place, ...STEP_BOX }
  })
  const blocks = view.blocks.map(({ x, y, width, height }): Box => ({ x, y, width, height }))
  return { idea, obstacles: [...others, ...steps, ...blocks] }
}
