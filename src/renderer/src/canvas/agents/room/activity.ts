import type { AgentVisual } from '../agentTypes'
import type { RoomActivity } from './RoomScene'

/**
 * Ce que fait le personnage selon l'état réel de l'agent (L1o D13) : au bureau quand il travaille, vie libre quand il
 * attend, sport quand il a fini ou qu'il est validé, réflexion au tableau quand le QA le renvoie, panique en erreur.
 */
export function activityOf(visual: AgentVisual): RoomActivity {
  switch (visual) {
    case 'running':
      return 'travail'
    case 'done':
    case 'validated':
    case 'merged':
      return 'fini'
    case 'sent-back':
      return 'pense'
    case 'blocked':
    case 'failed':
      return 'erreur'
    case 'cancelled':
      return 'repos'
    case 'sketch':
    case 'waiting':
      return 'libre'
  }
}
