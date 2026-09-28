import { create } from 'zustand'

interface HoverState {
  /** Lien survolé (souris). */
  readonly edgeId: string | null
  /** Idée survolée ou ayant le focus clavier : ses liens montrent leur libellé. */
  readonly nodeId: string | null
  setEdge(edgeId: string | null): void
  setNode(nodeId: string | null): void
}

/** Survol et focus sur la carte : les liens restent discrets et ne montrent leur libellé qu'à la demande. */
export const useCanvasHover = create<HoverState>()((set) => ({
  edgeId: null,
  nodeId: null,
  setEdge: (edgeId) => set({ edgeId }),
  setNode: (nodeId) => set({ nodeId })
}))
