import type { HatchedResultView } from '@shared/ipc/neurons'

/**
 * Prochaine étape d'une idée, tirée de son document en cours (jamais saisie ni modifiable) : celle de la synthèse
 * de réflexion, ou la première tâche faisable d'un plan d'action. `null` s'il n'y en a pas.
 */
export function nextStepOf(result: HatchedResultView | null): string | null {
  if (result === null) return null
  if (result.type === 'reflection_summary') {
    const step = result.nextStep?.trim() ?? ''
    return step === '' ? null : step
  }
  const open = result.nodes.filter((node) => node.type === 'task' && node.activeBranch)
  const next = open.find((node) => node.status === 'in_progress') ?? open.find((node) => node.status === 'ready')
  return next?.title ?? null
}
