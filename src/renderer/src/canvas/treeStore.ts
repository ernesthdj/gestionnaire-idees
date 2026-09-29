import { create } from 'zustand'
import type { PlacedItem } from './ideaTreeLayout'

/** Actions de l'idée ouverte, déclenchées depuis ses nœuds sur la carte. */
export interface OpenTreeActions {
  focus(neuronId: string): void
  selectExtension(extensionId: string): void
  acceptSuggestion(suggestionId: string): void
  dismissSuggestion(suggestionId: string): void
  /** Vérification web d'une idée suggérée, seulement à la demande (T069). */
  researchSuggestion(suggestionId: string): void
}

/** Arbre de l'idée ouverte, publié par le volet (`OpenIdea`) et dessiné sur la carte comme des nœuds physiques. */
export interface OpenTree {
  readonly rootId: string
  readonly items: readonly PlacedItem[]
  readonly focusId: string
  readonly selectedExtensionId: string | null
  /** Éclosion en cours : les sous-neurones se résorbent vers l'idée. */
  readonly fusing: boolean
  readonly categoryColor: string
  readonly actions: OpenTreeActions
}

interface OpenTreeState {
  readonly tree: OpenTree | null
  /** Fiche d'idée ouverte (double-clic) et textes d'idées dépliés. */
  readonly docId: string | null
  readonly expanded: ReadonlySet<string>
  publish(tree: OpenTree | null): void
  openDoc(id: string | null): void
  toggleNote(id: string): void
}

export const useOpenTree = create<OpenTreeState>()((set) => ({
  tree: null,
  docId: null,
  expanded: new Set(),
  publish: (tree) =>
    set((state) =>
      tree?.rootId === state.tree?.rootId ? { tree } : { tree, docId: null, expanded: new Set<string>() }
    ),
  openDoc: (id) => set({ docId: id }),
  toggleNote: (id) =>
    set((state) => {
      const expanded = new Set(state.expanded)
      if (expanded.has(id)) expanded.delete(id)
      else expanded.add(id)
      return { expanded }
    })
}))
