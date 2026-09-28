import type { ActionPlanOut, ReflectionSummaryOut } from '@shared/ai/neurons'

/**
 * Contrôles déterministes des synthèses (spec 002 contracts/ai-outputs.md P1–P5 et S1) :
 * l'IA propose, l'application vérifie avant de montrer quoi que ce soit.
 */

/** Profondeur maximale du plan (≠ profondeur de croissance de l'arbre, bornée à 6). */
export const MAX_PLAN_DEPTH = 5
export const MIN_BRANCHES = 2
export const MAX_BRANCHES = 4

export type CheckCode = 'AI_INVALID_OUTPUT' | 'CYCLE_DETECTED' | 'DEPTH_EXCEEDED'

export interface CheckFailure {
  readonly code: CheckCode
  readonly message: string
}

const fail = (code: CheckCode, message: string): CheckFailure => ({ code, message })

/** Tri topologique de Kahn : vrai si les arêtes forment un graphe sans boucle. */
export function isAcyclic(ids: readonly string[], edges: readonly (readonly [string, string])[]): boolean {
  const incoming = new Map(ids.map((id) => [id, 0]))
  const outgoing = new Map<string, string[]>()
  for (const [from, to] of edges) {
    incoming.set(to, (incoming.get(to) ?? 0) + 1)
    outgoing.set(from, [...(outgoing.get(from) ?? []), to])
  }
  const ready = ids.filter((id) => incoming.get(id) === 0)
  let visited = 0
  while (ready.length > 0) {
    const id = ready.pop()
    if (id === undefined) break
    visited++
    for (const next of outgoing.get(id) ?? []) {
      const remaining = (incoming.get(next) ?? 0) - 1
      incoming.set(next, remaining)
      if (remaining === 0) ready.push(next)
    }
  }
  return visited === ids.length
}

function unknownSourceRef(refs: readonly (readonly string[])[], known: ReadonlySet<string>): string | undefined {
  return refs.flat().find((ref) => !known.has(ref))
}

export function checkPlan(plan: ActionPlanOut, knownAliases: ReadonlySet<string>): CheckFailure | null {
  const byRef = new Map(plan.nodes.map((node) => [node.ref, node]))

  // P1 — références : uniques, parents et dépendances existants, pas de dépendance sur soi ni en double.
  if (byRef.size !== plan.nodes.length) return fail('AI_INVALID_OUTPUT', 'Références de plan en double')
  for (const node of plan.nodes) {
    if (node.parentRef !== undefined && (!byRef.has(node.parentRef) || node.parentRef === node.ref)) {
      return fail('AI_INVALID_OUTPUT', `Parent inconnu pour « ${node.title} »`)
    }
  }
  const pairs = new Set<string>()
  for (const dependency of plan.dependencies) {
    if (!byRef.has(dependency.fromRef) || !byRef.has(dependency.toRef) || dependency.fromRef === dependency.toRef) {
      return fail('AI_INVALID_OUTPUT', 'Dépendance vers une étape inconnue')
    }
    const pair = `${dependency.fromRef}>${dependency.toRef}`
    if (pairs.has(pair)) return fail('AI_INVALID_OUTPUT', 'Dépendance en double')
    pairs.add(pair)
  }

  // Hiérarchie sans boucle, puis P3 — profondeur du plan.
  const parentEdges = plan.nodes.flatMap((node) =>
    node.parentRef === undefined ? [] : [[node.parentRef, node.ref] as const]
  )
  if (!isAcyclic([...byRef.keys()], parentEdges)) return fail('CYCLE_DETECTED', 'La hiérarchie du plan boucle')
  for (const node of plan.nodes) {
    let depth = 1
    for (let current = node; current.parentRef !== undefined; depth++) {
      const parent = byRef.get(current.parentRef)
      if (parent === undefined) break
      current = parent
    }
    if (depth > MAX_PLAN_DEPTH) return fail('DEPTH_EXCEEDED', `Plan trop profond (max ${MAX_PLAN_DEPTH} niveaux)`)
  }

  // P2 — chaque condition a 2 à 4 branches libellées.
  for (const condition of plan.nodes.filter((node) => node.type === 'condition')) {
    const branches = plan.nodes.filter((node) => node.parentRef === condition.ref)
    if (branches.length < MIN_BRANCHES || branches.length > MAX_BRANCHES) {
      return fail('AI_INVALID_OUTPUT', `La condition « ${condition.title} » doit avoir 2 à 4 branches`)
    }
    if (branches.some((branch) => branch.branchLabel === undefined)) {
      return fail('AI_INVALID_OUTPUT', `Branche sans libellé sous « ${condition.title} »`)
    }
  }

  // P4 — dépendances sans boucle (Kahn).
  const dependencyEdges = plan.dependencies.map((dependency) => [dependency.fromRef, dependency.toRef] as const)
  if (!isAcyclic([...byRef.keys()], dependencyEdges)) {
    return fail('CYCLE_DETECTED', 'Les dépendances du plan forment une boucle')
  }

  // P5 — chaque source citée existe dans l'arbre.
  const unknown = unknownSourceRef(
    plan.nodes.map((node) => node.sourceRefs),
    knownAliases
  )
  return unknown === undefined ? null : fail('AI_INVALID_OUTPUT', `Source inconnue : ${unknown}`)
}

/** S1 — synthèse Réflexion : au moins un point clé, sources existantes. */
export function checkReflection(summary: ReflectionSummaryOut, knownAliases: ReadonlySet<string>): CheckFailure | null {
  if (summary.keyPoints.length === 0) return fail('AI_INVALID_OUTPUT', 'Synthèse sans point clé')
  const unknown = unknownSourceRef(
    [...summary.keyPoints, ...summary.decisions, ...summary.pros, ...summary.cons].map((point) => point.sourceRefs),
    knownAliases
  )
  return unknown === undefined ? null : fail('AI_INVALID_OUTPUT', `Source inconnue : ${unknown}`)
}
