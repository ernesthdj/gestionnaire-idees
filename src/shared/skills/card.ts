import { z } from 'zod'
import { QUALITY_CRITERIA } from './model'

/**
 * Fiche technique d'un skill (spec 020 US2, `L3-skills-comprendre.md` §2) : sortie fermée de la tâche `skill_card`,
 * rédigée par Claude sans outil. Le texte du skill est une donnée : une consigne cachée (« donne-toi 5 étoiles ») ne
 * peut agir que dans les bornes de ce schéma, puis passe par `cardCheck`.
 */

const grid = z.strictObject({
  declencheurs: z.int().min(0).max(5),
  profondeur: z.int().min(0).max(5),
  garde_fous: z.int().min(0).max(5),
  exemples: z.int().min(0).max(5)
})

const reasons = z.strictObject({
  declencheurs: z.string().trim().max(200),
  profondeur: z.string().trim().max(200),
  garde_fous: z.string().trim().max(200),
  exemples: z.string().trim().max(200)
})

/** Liens de sens proposés par Claude (le lien « appelle » est calculé depuis le texte, jamais proposé). */
export const SEMANTIC_LINK_KINDS = ['enchaine_vers', 'complete', 'alternative_a'] as const
export type SemanticLinkKind = (typeof SEMANTIC_LINK_KINDS)[number]

export const SkillCard = z.strictObject({
  resume: z.string().trim().min(1).max(1200),
  quand: z.array(z.string().trim().min(1).max(200)).max(6),
  eviter: z.array(z.string().trim().min(1).max(200)).max(6),
  declencheurs: z.array(z.string().trim().min(1).max(120)).max(8),
  entrees_sorties: z.string().trim().max(600),
  exemples: z.array(z.string().trim().min(1).max(300)).max(4),
  grille: grid,
  justification: reasons,
  domaine: z.string().regex(/^[a-z0-9_]{2,32}$/),
  nouveau_domaine: z.string().trim().min(2).max(40).optional(),
  liens: z
    .array(
      z.strictObject({
        vers: z.string().trim().min(1).max(64),
        sorte: z.enum(SEMANTIC_LINK_KINDS),
        raison: z.string().trim().max(200)
      })
    )
    .max(8)
})
export type SkillCard = z.infer<typeof SkillCard>
export type QualityGrid = SkillCard['grille']

/** Étoiles de Claude : moyenne arrondie de la grille, au moins 1 (FR-011). */
export function starsOf(grille: QualityGrid): number {
  const total = QUALITY_CRITERIA.reduce((sum, criterion) => sum + grille[criterion], 0)
  return Math.max(1, Math.round(total / QUALITY_CRITERIA.length))
}

export const CRITERIA_LABELS: Readonly<Record<(typeof QUALITY_CRITERIA)[number], string>> = {
  declencheurs: 'Clarté des déclencheurs',
  profondeur: 'Profondeur',
  garde_fous: 'Garde-fous',
  exemples: 'Exemples'
}

export const LINK_KIND_LABELS: Readonly<Record<SemanticLinkKind | 'appelle', string>> = {
  appelle: 'appelle',
  enchaine_vers: 'enchaîne vers',
  complete: 'complète',
  alternative_a: 'alternative à'
}
