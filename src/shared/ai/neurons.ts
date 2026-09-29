import { z } from 'zod'

/**
 * Sorties IA du moteur de neurones (spec 002 contracts/ai-outputs.md).
 * Validées par le moteur IA puis par les contrôles déterministes (E1–E4, P1–P6, S1, L1).
 */

const Level = z.enum(['insufficient', 'sufficient', 'complete'])
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/**
 * Tolérance aux sorties imparfaites (surtout du modèle local, dont Ollama n'impose pas les motifs) : on répare ce
 * qui est réparable et on écarte seulement l'élément fautif au lieu de rejeter toute la réponse. Ces `preprocess`
 * ne changent pas le schéma JSON transmis au modèle.
 */
function lenientList<T extends z.ZodType>(item: T, max: number) {
  return z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((entry) => item.safeParse(entry).success).slice(0, max) : value),
    z.array(item).max(max)
  )
}

/** « [s2] » ou « s2 » → « s2 » : le modèle recopie parfois les crochets de la liste des neurones. */
const unbracket = (value: unknown): unknown =>
  typeof value === 'string' ? value.replace(/^\s*\[|\]\s*$/g, '').trim() : value

export const Extension = z.object({
  question: z.string().min(1).max(300),
  quickReplies: lenientList(z.string().min(1).max(40), 4),
  dimension: z.string().min(1).max(40),
  answerKind: z.enum(['answer', 'condition', 'opportunity']).optional()
})
export type Extension = z.infer<typeof Extension>

/**
 * Suggestion d'approfondissement (neurone fantôme) : une piste ou une réponse possible, rattachée à un neurone.
 * `webQuery` demande une vérification sur le web (prix, disponibilité…) avant de la montrer comme sourcée.
 */
export const SuggestionOut = z.object({
  neuronRef: z.preprocess(unbracket, z.string().regex(/^s\d{1,3}$/)),
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(500),
  webQuery: z.string().min(3).max(200).optional()
})
export type SuggestionOut = z.infer<typeof SuggestionOut>

/** `etendre` : nouvelles extensions pour le neurone ciblé + évaluation du contexte de tout l'arbre (R1). */
export const EtendreOut = z.object({
  kind: z.enum(['extensions', 'out_of_scope']),
  outOfScopeMessage: z.string().min(1).max(300).optional(),
  extensions: lenientList(Extension, 8),
  suggestions: lenientList(SuggestionOut, 2),
  assessment: z.object({
    level: Level,
    covered: lenientList(z.string().min(1).max(40), 12),
    missing: lenientList(z.string().min(1).max(40), 12)
  }),
  // Facultative : une opportunité mal formée est ignorée plutôt que de faire rejeter les questions.
  detectedOpportunity: z
    .object({
      title: z.string().min(1).max(120),
      amountCents: z.number().int().min(0).optional().catch(undefined),
      expectedDate: IsoDate.optional().catch(undefined)
    })
    .optional()
    .catch(undefined)
})
export type EtendreOut = z.infer<typeof EtendreOut>

const Ref = z.string().regex(/^[a-z][a-z0-9]{0,15}$/)
const SourceRefs = z.array(z.preprocess(unbracket, z.string().min(1).max(16))).max(20)

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

/** Graine (spec 003 FR-028) : une idée nouvelle née de la rencontre de deux idées reliées. */
export const SeedOut = z.object({
  title: z.string().min(1).max(120),
  why: z.string().min(1).max(200)
})
export type SeedOut = z.infer<typeof SeedOut>

/** Graine facultative : mal formée, elle est ignorée sans faire rejeter le reste de la réponse. */
const optionalSeed = SeedOut.optional().catch(undefined)

export const SuggererLiensOut = z.object({
  links: z
    .array(
      z.object({
        targetAlias: z.string().regex(/^N([1-9]|10)$/),
        label: z.string().min(1).max(40),
        justification: z.string().min(1).max(200),
        seed: optionalSeed
      })
    )
    .max(3)
})
export type SuggererLiensOut = z.infer<typeof SuggererLiensOut>

/** `germer` : 0 ou 1 graine pour un lien que l'utilisateur vient de créer. */
export const GermerOut = z.object({ seed: optionalSeed })
export type GermerOut = z.infer<typeof GermerOut>
