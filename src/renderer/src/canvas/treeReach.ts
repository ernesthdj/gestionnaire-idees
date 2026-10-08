import type { IdeasCanvasView } from '@shared/ipc/canvas'
import { TIER_SIZE, tierOf } from './buildGraph'
import { planLayout } from './planLayout'
import { ELEMENT_SIZE, structureGraph } from './structureGraph'

/** Marge autour du nœud le plus éloigné d'un arbre (son titre, de l'air). */
export const REACH_MARGIN = 96

/**
 * Portée de l'arbre d'une idée (spec 022) : distance de son centre au bord du nœud le plus éloigné de son plan
 * d'attaque (nœuds affichés, repli compris) et de sa carte de structure. La physique s'en sert comme encombrement, pour
 * qu'une idée nouvelle ou libérée ne pose pas son arbre sur celui d'une voisine. 0 sans arbre. Fonction pure.
 */
export function treeReach(view: IdeasCanvasView, genesisId: string): number {
  const genesis = view.ideas.find((idea) => idea.id === genesisId)
  if (genesis === undefined) return 0
  const center = { x: 0, y: 0 }
  const elements = view.elements.filter((element) => element.genesisId === genesisId)
  const steps = view.steps.filter((step) => step.genesisId === genesisId)
  const ids = new Set([genesisId, ...steps.map((step) => step.id)])
  const plan = planLayout({
    genesisId,
    center,
    steps,
    proposals: view.proposals.filter((proposal) => ids.has(proposal.parentId)),
    documents: view.documents.filter((document) => ids.has(document.neuronId)),
    deliverables: view.deliverables.filter((deliverable) => ids.has(deliverable.neuronId)),
    rootRadius: TIER_SIZE[tierOf(genesis)] / 2,
    beside: elements.length > 0,
    rootCollapsed: genesis.planCollapsed === true
  })
  const planReach = plan.items
    .filter((item) => !item.folded)
    .reduce((max, item) => Math.max(max, Math.hypot(item.x, item.y) + REACH_MARGIN), 0)
  const structure = structureGraph(elements, new Map([[genesisId, center]]), view.mapLinks, view.measuredLinks)
  const half = Math.hypot(ELEMENT_SIZE.width, ELEMENT_SIZE.height) / 2
  const structureReach = structure.placed.reduce((max, entry) => Math.max(max, Math.hypot(entry.x, entry.y) + half), 0)
  return Math.round(Math.max(planReach, structureReach))
}
