import type { CanvasNeuronView, IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import type { CategoryView } from '../../../src/shared/ipc/neurons'

/** Données FICTIVES de l'écran Idées : une idée dans chaque état (un seul espace), deux écloses reliées par un lien suggéré. */
export const CATEGORIES: CategoryView[] = [
  { id: 'cat-achat', slug: 'achat', label: 'Achat', color: '#b45309' },
  { id: 'cat-photo', slug: 'photo', label: 'Photo', color: '#be185d' }
]

function neuron(id: string, title: string, patch: Partial<CanvasNeuronView> = {}): CanvasNeuronView {
  return {
    id,
    title,
    content: null,
    nature: 'reflection',
    natureSource: 'ai',
    category: CATEGORIES[0] ?? null,
    categorySource: 'ai',
    state: 'raw',
    version: 0,
    position: null,
    pinned: false,
    createdAt: '2026-09-28T10:00:00.000Z',
    updatedAt: '2026-09-28T10:00:00.000Z',
    contextLevel: null,
    locked: false,
    lockProposed: false,
    ...patch
  }
}

export const RAW_ID = '00000000-0000-4000-8000-000000000001'
export const DEVELOPING_ID = '00000000-0000-4000-8000-000000000002'
export const HATCHED_A_ID = '00000000-0000-4000-8000-000000000003'
export const HATCHED_B_ID = '00000000-0000-4000-8000-000000000004'
export const LINK_ID = '00000000-0000-4000-8000-000000000009'

export function canvasView(): IdeasCanvasView {
  return {
    counts: { raw: 1, developing: 1, hatched: 2 },
    ideas: [
      neuron(RAW_ID, 'Acheter un flash cobra'),
      neuron(DEVELOPING_ID, 'Deuxième écran', {
        state: 'developing',
        nature: 'action',
        natureSource: 'user',
        categorySource: 'user',
        contextLevel: 'insufficient'
      }),
      neuron(HATCHED_A_ID, 'Mission mariage', { state: 'hatched', category: CATEGORIES[1] ?? null }),
      neuron(HATCHED_B_ID, 'Portfolio photo', { state: 'hatched', category: CATEGORIES[1] ?? null })
    ],
    categories: CATEGORIES,
    highlighted: null,
    blocks: [],
    io: [],
    mapLinks: [
      {
        id: LINK_ID,
        from: { kind: 'idea', id: HATCHED_A_ID },
        to: { kind: 'idea', id: HATCHED_B_ID },
        label: 'financement',
        origin: 'user',
        relation: null
      }
    ],
    elements: [],
    steps: [],
    proposals: [],
    documents: [],
    deliverables: []
  }
}

export function emptyCanvasView(): IdeasCanvasView {
  return {
    counts: { raw: 0, developing: 0, hatched: 0 },
    ideas: [],
    categories: CATEGORIES,
    highlighted: null,
    blocks: [],
    io: [],
    mapLinks: [],
    elements: [],
    steps: [],
    proposals: [],
    documents: [],
    deliverables: []
  }
}
