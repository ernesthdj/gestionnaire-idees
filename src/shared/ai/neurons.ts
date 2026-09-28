import { z } from 'zod'

/**
 * Sorties IA du moteur de neurones (spec 002 contracts/ai-outputs.md).
 * Validées par le moteur IA puis par les contrôles déterministes (E1–E4, P1–P6, S1, L1).
 */

const Level = z.enum(['insufficient', 'sufficient', 'complete'])
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const Extension = z.object({
  question: z.string().min(1).max(300),
  quickReplies: z.array(z.string().min(1).max(40)).max(4),
  dimension: z.string().min(1).max(40),
  answerKind: z.enum(['answer', 'condition', 'opportunity']).optional()
})
export type Extension = z.infer<typeof Extension>

/** `etendre` : nouvelles extensions pour le neurone ciblé + évaluation du contexte de tout l'arbre (R1). */
export const EtendreOut = z.object({
  kind: z.enum(['extensions', 'out_of_scope']),
  outOfScopeMessage: z.string().min(1).max(300).optional(),
  extensions: z.array(Extension).max(8),
  assessment: z.object({
    level: Level,
    covered: z.array(z.string().min(1).max(40)).max(12),
    missing: z.array(z.string().min(1).max(40)).max(12)
  }),
  detectedOpportunity: z
    .object({
      title: z.string().min(1).max(120),
      amountCents: z.number().int().min(0).optional(),
      expectedDate: IsoDate.optional()
    })
    .optional()
})
export type EtendreOut = z.infer<typeof EtendreOut>

const Ref = z.string().regex(/^[a-z][a-z0-9]{0,15}$/)
const SourceRefs = z.array(z.string().min(1).max(16)).max(20)

export const ActionPlanOut = z.object({
  nodes: z
    .array(
      z.object({
        ref: Ref,
        type: z.enum(['task', 'condition', 'opportunity']),
        title: z.string().min(1).max(120),
        parentRef: Ref.optional(),
        branchLabel: z.string().min(1).max(40).optional(),
        question: z.string().min(1).max(200).optional(),
        amountCents: z.number().int().min(0).optional(),
        dueDate: IsoDate.optional(),
        toSchedule: z.boolean().optional(),
        investigation: z.boolean().optional(),
        sourceRefs: SourceRefs
      })
    )
    .min(1)
    .max(60),
  dependencies: z
    .array(
      z.object({
        fromRef: Ref,
        toRef: Ref,
        kind: z.enum(['after_done', 'on_trigger']),
        triggerLabel: z.string().min(1).max(80).optional()
      })
    )
    .max(80),
  gaps: z.array(z.string().min(1).max(200)).max(10)
})
export type ActionPlanOut = z.infer<typeof ActionPlanOut>

const Point = z.object({ text: z.string().min(1).max(300), sourceRefs: SourceRefs })

export const ReflectionSummaryOut = z.object({
  keyPoints: z.array(Point).min(1).max(10),
  decisions: z.array(Point).max(10),
  pros: z.array(Point).max(10),
  cons: z.array(Point).max(10),
  openQuestions: z.array(z.object({ text: z.string().min(1).max(300) })).max(10)
})
export type ReflectionSummaryOut = z.infer<typeof ReflectionSummaryOut>

export const SuggererLiensOut = z.object({
  links: z
    .array(
      z.object({
        targetAlias: z.string().regex(/^N([1-9]|10)$/),
        label: z.string().min(1).max(40),
        justification: z.string().min(1).max(200)
      })
    )
    .max(3)
})
export type SuggererLiensOut = z.infer<typeof SuggererLiensOut>
