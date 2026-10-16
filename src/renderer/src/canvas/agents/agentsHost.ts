import type { CardSubject } from '../cards/cardContent'
import type { WorkflowItem } from '../workflow/workflowTree'

/** Un nœud du Workflow qui peut accueillir des agents : tâche, lot, fichier de tâches, spec, story, document. */
export const hostsAgents = (item: WorkflowItem): boolean => item.subject.kind !== 'message'

/**
 * Genesis du projet d'un nœud auquel on peut connecter des agents (T006, L1o D14) : seulement un nœud de la vue
 * Workflow, là où le travail se fait ; Progression et Architecture ne font que refléter. `null` pour tout autre sujet.
 */
export function agentsGenesisOf(subject: CardSubject): string | null {
  return subject.kind === 'workflow' && hostsAgents(subject.item) ? subject.genesisId : null
}
