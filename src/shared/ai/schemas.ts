import { z } from 'zod'

/** Sortie de `categoriser` (IA locale) : catégorie et nature proposées pour un neurone. */
export const CategoryOut = z.object({
  categorySlug: z.enum(['general', 'achat', 'projet', 'sortie', 'photo', 'it']),
  nature: z.enum(['action', 'reflection'])
})
export type CategoryOut = z.infer<typeof CategoryOut>

/** Sortie de `resumer` (IA locale) : résumé court d'une idée et de ce que le brainstorming lui a apporté. */
