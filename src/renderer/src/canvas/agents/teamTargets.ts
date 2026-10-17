import type { AssemblySketchView } from '@shared/ipc/assemblies'
import type { WorkflowView } from '@shared/ipc/workflow'
import { workflowTree, type WorkflowItem } from '../workflow/workflowTree'
import { hostsAgents } from './agentsHost'

const isTask = (item: WorkflowItem): boolean => item.key.split(':')[2] === 'ttask'

/** Nœuds du Workflow qui ont déjà une équipe : on n'y en pose pas une seconde. */
const busyHosts = (sketches: readonly AssemblySketchView[]): Set<string> =>
  new Set(sketches.filter((sketch) => sketch.agents.length > 0).map((sketch) => sketch.nodeId))

/**
 * Où déplacer une équipe (L1o D24) : les tâches du Workflow à faire, sans équipe, autres que la sienne ; la prochaine
 * (« Bosser ici ») en tête. Pur.
 */
export function moveTargets(
  view: WorkflowView,
  genesisId: string,
  sketches: readonly AssemblySketchView[],
  from: string
): WorkflowItem[] {
  const busy = busyHosts(sketches)
  return workflowTree({ view }, genesisId)
    .items.filter((item) => isTask(item) && item.status !== 'done' && item.key !== from && !busy.has(item.key))
    .sort((a, b) => Number(b.next === true) - Number(a.next === true))
}

/**
 * Où rattacher une équipe dont le nœud a disparu (L1o D27) : tout nœud du Workflow qui accueille des agents (tâche,
 * lot, document), sans équipe ; les tâches d'abord, la prochaine en tête. Pur.
 */
export function relinkTargets(
  view: WorkflowView,
  genesisId: string,
  sketches: readonly AssemblySketchView[]
): WorkflowItem[] {
  const busy = busyHosts(sketches)
  return workflowTree({ view }, genesisId)
    .items.filter((item) => hostsAgents(item) && !busy.has(item.key))
    .sort((a, b) => Number(isTask(b)) - Number(isTask(a)) || Number(b.next === true) - Number(a.next === true))
}

/** Équipes dont le nœud n'existe plus dans le Workflow lu (L1o D27). Pur. */
export function strayTeams(
  view: WorkflowView,
  genesisId: string,
  sketches: readonly AssemblySketchView[]
): AssemblySketchView[] {
  const keys = new Set(workflowTree({ view }, genesisId).items.map((item) => item.key))
  return sketches.filter(
    (sketch) =>
      sketch.genesisId === genesisId &&
      sketch.agents.length > 0 &&
      sketch.nodeId.startsWith('wf:') &&
      !keys.has(sketch.nodeId)
  )
}
