import { z } from 'zod'

/** Verdicts d'audit d'un skill importé (spec 020 US4) : du plus sûr au plus sévère. */
export const AUDIT_VERDICTS = ['sur', 'a_revoir', 'dangereux'] as const
export type AuditVerdict = (typeof AUDIT_VERDICTS)[number]

/** Sortie fermée de la tâche `skill_audit` (`L3-skills-importer.md` §3). */
export const SkillAuditOut = z.strictObject({
  verdict: z.enum(AUDIT_VERDICTS),
  raisons: z
    .array(z.strictObject({ texte: z.string().trim().min(1).max(200), ligne: z.number().int().min(1).optional() }))
    .max(8),
  role: z.string().trim().max(300)
})
export type SkillAuditOut = z.infer<typeof SkillAuditOut>
