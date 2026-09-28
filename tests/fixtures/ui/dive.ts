import type { NeuronView, RootView, TreeView } from '../../../src/shared/ipc/neurons'

/** Arbre FICTIF d'une idée en développement : 2 sous-neurones (dont un avec un enfant), 3 questions, 1 fantôme. */
export const ROOT_ID = '00000000-0000-4000-8000-00000000d001'
export const CHILD_ID = '00000000-0000-4000-8000-00000000d002'
export const LEAF_ID = '00000000-0000-4000-8000-00000000d003'
export const GRANDCHILD_ID = '00000000-0000-4000-8000-00000000d004'

export const ROOT: RootView = {
  id: ROOT_ID,
  title: 'Deuxième écran',
  content: null,
  nature: 'action',
  natureSource: 'ai',
  category: { id: 'cat-achat', slug: 'achat', label: 'Achat', color: '#b45309' },
  categorySource: 'ai',
  state: 'developing',
  version: 4,
  position: null,
  createdAt: '2026-09-28T10:00:00.000Z',
  updatedAt: '2026-09-28T10:00:00.000Z'
}

function sub(id: string, parentId: string, depth: number, title: string): NeuronView {
  return { id, parentId, depth, kind: 'answer', title, content: null, amountCents: null, dueDate: null, origin: 'user' }
}

export function developingTree(): TreeView {
  return {
    root: ROOT,
    neurons: [
      sub(CHILD_ID, ROOT_ID, 1, 'budget : 200 €'),
      sub(LEAF_ID, ROOT_ID, 1, 'usage : photo'),
      sub(GRANDCHILD_ID, CHILD_ID, 2, 'occasion : oui')
    ],
    extensions: [
      {
        id: 'ext-1',
        neuronId: ROOT_ID,
        question: 'Pour quand ?',
        quickReplies: ['Ce mois-ci', 'Plus tard'],
        dimension: 'quand',
        origin: 'ai',
        outsideNature: false
      },
      {
        id: 'ext-2',
        neuronId: ROOT_ID,
        question: 'Quelle taille ?',
        quickReplies: [],
        dimension: 'taille',
        origin: 'ai',
        outsideNature: false
      },
      {
        id: 'ext-3',
        neuronId: CHILD_ID,
        question: 'Neuf ou occasion ?',
        quickReplies: [],
        dimension: 'état',
        origin: 'ai',
        outsideNature: false
      }
    ],
    suggestions: [
      {
        id: 'sug-1',
        neuronId: ROOT_ID,
        title: 'Comparer les dalles IPS',
        content: 'Les dalles IPS rendent mieux les couleurs pour la retouche.',
        research: 'done',
        sources: [{ url: 'https://example.org/ips', title: 'Guide des dalles' }]
      }
    ],
    gauge: { level: 'insufficient', covered: ['budget'], missing: ['quand', 'taille'], answered: 2 }
  }
}

export function rawTree(): TreeView {
  return { root: { ...ROOT, state: 'raw' }, neurons: [], extensions: [], suggestions: [], gauge: null }
}
