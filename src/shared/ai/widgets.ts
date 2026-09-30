import { z } from 'zod'

/** Taille maximale de chaque partie d'un widget (spec 004 FR-005) : au-delà, la réponse est refusée. */
export const WIDGET_PART_MAX_CHARS = 100_000

const Part = z.string().max(WIDGET_PART_MAX_CHARS)

/** Sortie de la tâche `widget` (spec 004) : un widget complet, jamais un extrait. */
export const WidgetOut = z.object({
  title: z.string().min(1).max(80),
  html: Part,
  css: Part,
  ts: Part,
  summary: z.string().min(1).max(500)
})
export type WidgetOut = z.infer<typeof WidgetOut>
