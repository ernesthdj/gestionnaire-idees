import { z } from 'zod'

/**
 * État de vue d'un brainstorm (spec 024 R2) : ce qui n'est pas déjà en base à chaque geste — cadrage de la carte, vue
 * de chaque carte de projet (Workflow, Progression, Architecture), cartes de détails ouvertes. Enregistré en différé,
 * relu à l'ouverture ; borné (≤ 20 cartes, ≤ 500 genesis) et revalidé à chaque frontière.
 */

const finite = z.number().finite()
const id = z.string().min(1).max(200)

export const VIEW_STATE_LIMITS = { cards: 20, genesis: 500, bytes: 256 * 1024 } as const

export const ViewStateSchema = z.strictObject({
  version: z.literal(1),
  viewport: z.strictObject({ x: finite, y: finite, zoom: z.number().min(0.05).max(4) }).nullable(),
  structureViews: z
    .record(id, z.enum(['workflow', 'progression', 'architecture']))
    .refine((views) => Object.keys(views).length <= VIEW_STATE_LIMITS.genesis, 'Trop de vues'),
  openCards: z
    .array(
      z.strictObject({
        id,
        offset: z.strictObject({ x: finite, y: finite }),
        sheet: z.boolean(),
        side: z.enum(['chat', 'reader']).nullable(),
        pinned: z.boolean()
      })
    )
    .max(VIEW_STATE_LIMITS.cards)
})

export type ViewState = z.infer<typeof ViewStateSchema>

export const EMPTY_VIEW_STATE: ViewState = { version: 1, viewport: null, structureViews: {}, openCards: [] }

/** État de vue lu en base : `null` s'il est absent, illisible ou hors schéma (jamais d'erreur à l'ouverture). */
export function parseViewState(json: string | null): ViewState | null {
  if (json === null) return null
  try {
    const parsed = ViewStateSchema.safeParse(JSON.parse(json))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
