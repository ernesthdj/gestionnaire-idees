import { z } from 'zod'

/** Sortie de `categoriser` (IA locale) : catégorie et nature proposées pour un neurone. */
export const CategoryOut = z.object({
  categorySlug: z.enum(['general', 'achat', 'projet', 'sortie', 'photo', 'it']),
  nature: z.enum(['action', 'reflection'])
})
export type CategoryOut = z.infer<typeof CategoryOut>

/** Réponse de refus : demande d'œuvre finie ou hors du rôle de partenaire de réflexion. */
export const OutOfScope = z.object({
  kind: z.literal('out_of_scope'),
  message: z.string().min(1).max(300)
})
export type OutOfScope = z.infer<typeof OutOfScope>
