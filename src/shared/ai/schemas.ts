import { z } from 'zod'

/** Sortie de `categoriser` (IA locale) : catégorie et nature proposées pour un neurone. */
export const CategoryOut = z.object({
  categorySlug: z.enum(['general', 'achat', 'projet', 'sortie', 'photo', 'it']),
  nature: z.enum(['action', 'reflection'])
})
export type CategoryOut = z.infer<typeof CategoryOut>

/** Sections fixes du guide de reprise, dans l'ordre (spec 017 FR-027) ; leurs titres sont donnés par l'app. */
export const GUIDE_SECTION_IDS = [
  'une_phrase',
  'a_quoi_ca_sert',
  'lancer',
  'architecture',
  'points_entree',
  'conventions',
  'zones_risque',
  'par_ou_commencer',
  'glossaire'
] as const
export type GuideSectionId = (typeof GUIDE_SECTION_IDS)[number]

export const GUIDE_SECTION_TITLES: Readonly<Record<GuideSectionId, string>> = {
  une_phrase: 'En une phrase',
  a_quoi_ca_sert: 'À quoi ça sert',
  lancer: 'Comment le lancer',
  architecture: 'Architecture',
  points_entree: "Points d'entrée",
  conventions: 'Conventions observées',
  zones_risque: 'Zones à risque',
  par_ou_commencer: 'Par où commencer',
  glossaire: 'Glossaire'
}

/**
 * Sortie de `reprise_guide` (spec 017 US4) : les 9 sections, chacune ouverte par une analogie (D6), avec ses sources
 * (chemins relatifs ou clés de modules, vérifiés ensuite sur le disque), et un résumé-analogie par module.
 */
export const GuideOut = z.object({
  sections: z
    .array(
      z.object({
        id: z.enum(GUIDE_SECTION_IDS),
        analogy: z.string().trim().min(1).max(600),
        markdown: z.string().max(8000),
        sources: z.array(z.string().trim().min(1).max(300)).max(20)
      })
    )
    .length(GUIDE_SECTION_IDS.length)
    .refine((sections) => new Set(sections.map((section) => section.id)).size === GUIDE_SECTION_IDS.length, {
      message: 'Chaque section doit apparaître une seule fois'
    }),
  modules: z
    .array(
      z.object({
        key: z.string().min(1).max(200),
        summary: z.string().trim().min(1).max(400),
        analogy: z.string().trim().min(1).max(400)
      })
    )
    .max(100)
})
export type GuideOut = z.infer<typeof GuideOut>

/** Sortie de `resumer` (IA locale) : résumé court d'une idée et de ce que le brainstorming lui a apporté. */

/**
 * Sortie de `file_summary` (spec 023 D15) : ce que fait un fichier, en langage simple — son rôle, ce qu'il reçoit, ce
 * qu'il produit, et ses morceaux importants (noms exacts de blocs du fichier, vérifiés ensuite).
 */
export const FileSummaryOut = z.object({
  role: z.string().trim().min(1).max(400),
  recoit: z.string().trim().min(1).max(400),
  produit: z.string().trim().min(1).max(400),
  morceaux: z
    .array(z.object({ nom: z.string().trim().min(1).max(200), utilite: z.string().trim().min(1).max(300) }))
    .min(1)
    .max(6),
  /** Petit schéma (D15, précisé) : `de` = « entree » ou un morceau, `vers` = un morceau ou « sortie », `verbe` court. */
  liens: z
    .array(
      z.object({
        de: z.string().trim().min(1).max(200),
        vers: z.string().trim().min(1).max(200),
        verbe: z.string().trim().min(1).max(40)
      })
    )
    .max(10)
})
export type FileSummaryOut = z.infer<typeof FileSummaryOut>
