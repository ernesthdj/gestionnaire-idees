import type { IdeasCanvasView } from '@shared/ipc/canvas'
import { bornIn, type StructureViewKind } from '../buildGraph'
import { deliverableNodeId, documentNodeId, ghostNodeId } from '../planLayout'

/**
 * Nœuds qui existent dans la vue du canevas, toutes vues confondues (spec 027 R11) : idées, étapes, étapes proposées,
 * éléments, documents, livrables. Un nœud seulement caché (repli, autre vue) y reste : son onglet ne se ferme pas.
 */
export function viewNodeIds(view: IdeasCanvasView): ReadonlySet<string> {
  return new Set([
    ...view.ideas.map((idea) => idea.id),
    ...view.steps.map((step) => step.id),
    ...view.proposals.flatMap((proposal) => proposal.items.map((item) => ghostNodeId(item.id))),
    ...view.elements.map((element) => element.id),
    ...view.documents.map((document) => documentNodeId(document.id)),
    ...view.deliverables.map((deliverable) => deliverableNodeId(deliverable.neuronId))
  ])
}

/**
 * Titres de repli des nœuds à conversation, lus dans la vue (un nœud replié n'est pas dessiné : la carte n'a pas son
 * en-tête complet) ; ceux des nœuds dessinés les remplacent.
 */
export function viewTitles(view: IdeasCanvasView): Map<string, { title: string; kindLabel: string }> {
  const titles = new Map<string, { title: string; kindLabel: string }>()
  for (const idea of view.ideas) titles.set(idea.id, { title: idea.title, kindLabel: 'Idée' })
  for (const step of view.steps) titles.set(step.id, { title: step.title, kindLabel: 'Étape' })
  for (const element of view.elements) titles.set(element.id, { title: element.title, kindLabel: 'Élément' })
  return titles
}

/**
 * Vue de la carte d'un projet où un nœud est dessiné (spec 027 R5), pour « Centrer sur le nœud » quand une autre vue est
 * affichée : tâche Workflow → Workflow ; élément → Progression ; étape (et ce qui s'y rattache : étape proposée,
 * document, livrable) → la vue où elle est née (spec 023 D19). `null` : nœud présent dans toutes les vues (idée), ou
 * introuvable.
 */
export function focusViewOf(
  nodeId: string,
  view: IdeasCanvasView
): { readonly genesisId: string; readonly kind: StructureViewKind } | null {
  const [prefix, genesis] = nodeId.split(':')
  if (prefix === 'wf' && genesis !== undefined && genesis !== '') return { genesisId: genesis, kind: 'workflow' }
  const element = view.elements.find((entry) => entry.id === nodeId)
  if (element !== undefined) return { genesisId: element.genesisId, kind: 'progression' }
  const stepId =
    view.proposals.find((proposal) => proposal.items.some((item) => ghostNodeId(item.id) === nodeId))?.parentId ??
    view.documents.find((document) => documentNodeId(document.id) === nodeId)?.neuronId ??
    view.deliverables.find((deliverable) => deliverableNodeId(deliverable.neuronId) === nodeId)?.neuronId ??
    nodeId
  const step = view.steps.find((entry) => entry.id === stepId)
  if (step === undefined) return null
  const linked = view.ideas.find((idea) => idea.id === step.genesisId)?.linkedProject === true
  return { genesisId: step.genesisId, kind: bornIn(step, linked) }
}
