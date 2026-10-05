/**
 * Ordre d'un plan d'attaque (spec 011) : rangs et dépendances entre étapes sœurs. Fonctions pures.
 * Une étape attend uniquement des sœurs, sans cycle, et vient toujours après ce qu'elle attend.
 */

export interface RankedStep {
  readonly id: string
  readonly rank: number
  readonly waitsFor: readonly string[]
}

export type DependencyProblem = 'CYCLE' | 'OUTSIDE' | 'ORDER'

/** `null` si les dépendances des sœurs sont valides ; sinon le premier problème trouvé (cycle d'abord). */
export function checkDependencies(steps: readonly RankedStep[]): DependencyProblem | null {
  const byId = new Map(steps.map((entry) => [entry.id, entry] as const))
  if (steps.some((entry) => entry.waitsFor.some((id) => !byId.has(id)))) return 'OUTSIDE'
  if (hasCycle(steps, byId)) return 'CYCLE'
  const ordered = steps.every((entry) => entry.waitsFor.every((id) => (byId.get(id)?.rank ?? 0) < entry.rank))
  return ordered ? null : 'ORDER'
}

function hasCycle(steps: readonly RankedStep[], byId: ReadonlyMap<string, RankedStep>): boolean {
  const state = new Map<string, 'visiting' | 'done'>()
  const visit = (id: string): boolean => {
    const current = state.get(id)
    if (current === 'visiting') return true
    if (current === 'done') return false
    state.set(id, 'visiting')
    const cyclic = (byId.get(id)?.waitsFor ?? []).some(visit)
    state.set(id, 'done')
    return cyclic
  }
  return steps.some((entry) => visit(entry.id))
}

/** Rangs 1..n dans l'ordre actuel (après un retrait ou une naissance). */
export function renumber(steps: readonly RankedStep[]): RankedStep[] {
  return [...steps].sort((a, b) => a.rank - b.rank).map((entry, index) => ({ ...entry, rank: index + 1 }))
}

/**
 * Déplace une étape au rang voulu (borné au nombre de sœurs) et renumérote ; `null` si l'étape est inconnue ou si le
 * nouvel ordre place une étape avant ce qu'elle attend.
 */
export function moveRank(steps: readonly RankedStep[], stepId: string, rank: number): RankedStep[] | null {
  const ordered = renumber(steps)
  const index = ordered.findIndex((entry) => entry.id === stepId)
  const [moved] = index === -1 ? [] : ordered.splice(index, 1)
  if (moved === undefined) return null
  const target = Math.min(Math.max(rank, 1), ordered.length + 1) - 1
  ordered.splice(target, 0, moved)
  const next = ordered.map((entry, position) => ({ ...entry, rank: position + 1 }))
  return checkDependencies(next) === null ? next : null
}
