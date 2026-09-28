import type { ActionPlanOut } from '@shared/ai/neurons'
import { extractValues, isUserDate } from './extractValues'

const MAX_GAPS = 10

export interface ProvenanceResult {
  readonly plan: ActionPlanOut
  /** Valeurs retirées car jamais écrites par l'utilisateur (remplacées par un élément « à trouver »). */
  readonly removed: number
  /** Montants masqués à l'IA (fourchettes) remis à leur valeur exacte depuis l'unique réponse source. */
  readonly restored: number
}

/**
 * Contrôle P6 : un montant ou une date du plan doit venir des mots de l'utilisateur.
 * Sinon la valeur est retirée et le nœud devient un élément « à trouver » (investigation + manque listé).
 * Les montants étant anonymisés en fourchettes avant l'envoi à Claude, un montant proposé dont les
 * `sourceRefs` désignent une seule valeur exacte en euros reprend cette valeur.
 */
export function applyProvenance(plan: ActionPlanOut, sources: ReadonlyMap<string, string>): ProvenanceResult {
  const all = extractValues([...sources.values()])
  const gaps = [...plan.gaps]
  let removed = 0
  let restored = 0

  const nodes = plan.nodes.map((node) => {
    const next = { ...node }
    if (node.amountCents !== undefined && !all.amountsCents.has(node.amountCents)) {
      const cited = extractValues(node.sourceRefs.flatMap((ref) => sources.get(ref) ?? []))
      const [only, ...others] = [...cited.euroAmountsCents]
      if (only !== undefined && others.length === 0) {
        next.amountCents = only
        restored++
      } else {
        delete next.amountCents
        next.investigation = true
        gaps.push(`Montant à trouver : ${node.title}`)
        removed++
      }
    }
    if (node.dueDate !== undefined && !isUserDate(node.dueDate, all)) {
      delete next.dueDate
      next.investigation = true
      next.toSchedule = true
      gaps.push(`Date à trouver : ${node.title}`)
      removed++
    }
    return next
  })

  return { plan: { ...plan, nodes, gaps: gaps.slice(0, MAX_GAPS) }, removed, restored }
}
