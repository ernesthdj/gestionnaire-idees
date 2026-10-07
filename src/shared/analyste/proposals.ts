import { z } from 'zod'

/** Propositions de l'Analyste (spec 019 FR-015, D8) : catégories, risques et forme de sortie imposée à Claude. */

export const PROPOSAL_CATEGORIES = ['bug', 'ia_vers_code', 'parcours', 'code_mort', 'evolutivite'] as const
export type ProposalCategory = (typeof PROPOSAL_CATEGORIES)[number]

export const PROPOSAL_RISKS = ['faible', 'moyen', 'eleve'] as const
export type ProposalRisk = (typeof PROPOSAL_RISKS)[number]

/** Gravité : 1 (faible) à 4 (critique). Les plus graves passent d'abord (FR-017). */
export const SEVERITY = { min: 1, max: 4 } as const

/** Clé d'un agrégat d'observations citée comme preuve. */
export const OBSERVATION_KEY = /^obs:[a-z]+:\d+$/

/**
 * Une proposition telle que Claude doit la rendre (`L3-analyste-analyse.md` §4) : schéma fermé, aucun champ en plus.
 * Elle est ensuite revérifiée par l'app (chemins, clés, preuves) avant d'être gardée.
 */
export const AnalysteProposalOut = z
  .object({
    categorie: z.enum(PROPOSAL_CATEGORIES),
    titre: z.string().min(5).max(80),
    constat: z.string().max(1200),
    preuves: z
      .object({
        observations: z.array(z.string().regex(OBSERVATION_KEY)).max(10),
        code: z
          .array(
            z
              .object({
                chemin: z.string().min(1).max(200),
                debut: z.int().min(1).optional(),
                fin: z.int().min(1).optional()
              })
              .strict()
          )
          .max(10)
      })
      .strict(),
    proposition: z.string().max(1500),
    gain: z.string().max(300),
    risque: z.enum(PROPOSAL_RISKS),
    gravite: z.int().min(SEVERITY.min).max(SEVERITY.max),
    confiance: z.number().min(0).max(1),
    fichiersVises: z.array(z.string().min(1).max(200)).max(20)
  })
  .strict()
export type AnalysteProposalOut = z.infer<typeof AnalysteProposalOut>

export const AnalysteOut = z.object({ propositions: z.array(AnalysteProposalOut).max(10) }).strict()
export type AnalysteOut = z.infer<typeof AnalysteOut>
