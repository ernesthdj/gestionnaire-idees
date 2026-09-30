import { z } from 'zod'

/** Sortie de `categoriser` (IA locale) : catégorie et nature proposées pour un neurone. */
export const CategoryOut = z.object({
  categorySlug: z.enum(['general', 'achat', 'projet', 'sortie', 'photo', 'it']),
  nature: z.enum(['action', 'reflection'])
})
export type CategoryOut = z.infer<typeof CategoryOut>

/** Sortie de `resumer` (IA locale) : résumé court d'une idée et de ce que le brainstorming lui a apporté. */
export const SummaryOut = z.object({ summary: z.string().trim().min(1).max(700) })
export type SummaryOut = z.infer<typeof SummaryOut>

/** Réponse de refus : demande d'œuvre finie ou hors du rôle de partenaire de réflexion. */
export const OutOfScope = z.object({
  kind: z.literal('out_of_scope'),
  message: z.string().min(1).max(300)
})
export type OutOfScope = z.infer<typeof OutOfScope>

/** Sortie de `anonymiser` (IA locale uniquement) : noms de personnes et de lieux présents dans le texte. */
export const SensitiveOut = z.object({
  persons: z.array(z.string().min(1).max(60)).max(20),
  places: z.array(z.string().min(1).max(80)).max(20)
})
export type SensitiveOut = z.infer<typeof SensitiveOut>
