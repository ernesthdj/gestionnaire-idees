import type { CanvasNeuronView, IdeasCanvasView } from '@shared/ipc/canvas'

/** Ce que Claude voit d'un projet repris « Local uniquement » sur la carte (spec 017 FR-004). */
export const LOCAL_PROJECT_TITLE = 'Projet repris (local) — contenu non transmis à Claude'

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

function masked(idea: CanvasNeuronView): CanvasNeuronView {
  const copy: Mutable<CanvasNeuronView> = { ...idea, title: LOCAL_PROJECT_TITLE, content: null }
  delete copy.sheetSummary
  return copy
}

/**
 * Vue de la carte telle que le pont MCP la montre à Claude (spec 017 FR-004) : un projet repris « Local uniquement »
 * n'y garde que sa place (titre neutre, sans description ni fiche) ; ses éléments, étapes, propositions, documents,
 * livrables et les liens qui les touchent disparaissent. Fonction pure.
 */
export function maskLocalProjects(
  view: IdeasCanvasView,
  isLocalGenesis: (genesisId: string) => boolean
): IdeasCanvasView {
  const local = new Set(view.ideas.filter((idea) => isLocalGenesis(idea.id)).map((idea) => idea.id))
  if (local.size === 0) return view
  const removed = new Set<string>([
    ...view.elements.filter((element) => local.has(element.genesisId)).map((element) => element.id),
    ...view.steps.filter((step) => local.has(step.genesisId)).map((step) => step.id),
    ...view.documents.filter((document) => local.has(document.genesisId)).map((document) => document.id)
  ])
  const hidden = (id: string): boolean => removed.has(id)
  return {
    ...view,
    ideas: view.ideas.map((idea) => (local.has(idea.id) ? masked(idea) : idea)),
    elements: view.elements.filter((element) => !hidden(element.id)),
    steps: view.steps.filter((step) => !hidden(step.id)),
    proposals: view.proposals.filter((proposal) => !local.has(proposal.parentId) && !hidden(proposal.parentId)),
    documents: view.documents.filter((document) => !hidden(document.id)),
    deliverables: view.deliverables.filter((deliverable) => !local.has(deliverable.genesisId)),
    mapLinks: view.mapLinks.filter((link) => !hidden(link.from.id) && !hidden(link.to.id)),
    io: view.io.filter((link) => !hidden(link.sourceId))
  }
}
