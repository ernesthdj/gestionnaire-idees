import { ActionPlanOut, ReflectionSummaryOut } from '@shared/ai/neurons'
import type { SynthesisPatch } from '@shared/ipc/neurons'
import { checkPlan, checkReflection } from './planChecks'

/** Sections corrigeables d'une synthèse de réflexion ; la référence d'un point est `section.index`. */
const SECTIONS = ['keyPoints', 'decisions', 'pros', 'cons', 'openQuestions'] as const
type Section = (typeof SECTIONS)[number]

export type PatchOutcome<T> =
  { readonly ok: true; readonly payload: T } | { readonly ok: false; readonly message: string }

/**
 * Correction d'un élément d'un plan d'action proposé (spec 003 T031, research R5) : titre, montant ou date d'un
 * nœud. Le plan corrigé repasse les contrôles P1–P5 ; la provenance P6 ne s'applique pas à une valeur que
 * l'utilisateur vient d'écrire lui-même.
 */
export function patchPlan(
  plan: ActionPlanOut,
  patch: SynthesisPatch,
  known: ReadonlySet<string>
): PatchOutcome<ActionPlanOut> {
  if (patch.text !== undefined) return { ok: false, message: 'Un plan se corrige par titre, montant ou date' }
  const index = plan.nodes.findIndex((node) => node.ref === patch.ref)
  const node = plan.nodes[index]
  if (node === undefined) return { ok: false, message: 'Élément du plan introuvable' }
  // `null` efface une valeur ; une clé absente la laisse telle quelle.
  const edited: Record<string, unknown> = { ...node }
  if (patch.title !== undefined) edited['title'] = patch.title
  if (patch.amountCents === null) delete edited['amountCents']
  else if (patch.amountCents !== undefined) edited['amountCents'] = patch.amountCents
  if (patch.dueDate === null) delete edited['dueDate']
  else if (patch.dueDate !== undefined) edited['dueDate'] = patch.dueDate
  const parsed = ActionPlanOut.safeParse({
    ...plan,
    nodes: plan.nodes.map((entry, i) => (i === index ? edited : entry))
  })
  if (!parsed.success) return { ok: false, message: 'Correction invalide' }
  const failure = checkPlan(parsed.data, known)
  return failure === null ? { ok: true, payload: parsed.data } : { ok: false, message: failure.message }
}

/** Correction du texte d'un point d'une synthèse de réflexion (ex. `pros.1`), revalidée par S1. */
export function patchReflection(
  summary: ReflectionSummaryOut,
  patch: SynthesisPatch,
  known: ReadonlySet<string>
): PatchOutcome<ReflectionSummaryOut> {
  if (
    patch.text === undefined ||
    patch.title !== undefined ||
    patch.amountCents !== undefined ||
    patch.dueDate !== undefined
  ) {
    return { ok: false, message: 'Une synthèse se corrige par le texte de ses points' }
  }
  const [section, position] = patch.ref.split('.')
  const index = Number(position)
  if (!(SECTIONS as readonly string[]).includes(section ?? '') || !Number.isInteger(index)) {
    return { ok: false, message: 'Point de la synthèse introuvable' }
  }
  const points: readonly { readonly text: string }[] = summary[section as Section]
  if (points[index] === undefined) return { ok: false, message: 'Point de la synthèse introuvable' }
  const text = patch.text
  const parsed = ReflectionSummaryOut.safeParse({
    ...summary,
    [section as Section]: points.map((point, i) => (i === index ? { ...point, text } : point))
  })
  if (!parsed.success) return { ok: false, message: 'Correction invalide' }
  const failure = checkReflection(parsed.data, known)
  return failure === null ? { ok: true, payload: parsed.data } : { ok: false, message: failure.message }
}
