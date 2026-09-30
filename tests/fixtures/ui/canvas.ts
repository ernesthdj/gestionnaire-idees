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
    subNeurons: [],
    subCount: 0,
    contextLevel: null,
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
        subNeurons: [{ id: 'sub-1', title: 'Budget à définir' }],
        subCount: 1,
        contextLevel: 'insufficient'
      }),
      neuron(HATCHED_A_ID, 'Mission mariage', { state: 'hatched', category: CATEGORIES[1] ?? null }),
      neuron(HATCHED_B_ID, 'Portfolio photo', { state: 'hatched', category: CATEGORIES[1] ?? null })
    ],
    links: [
      {
        id: LINK_ID,
        a: { id: HATCHED_A_ID, title: 'Mission mariage' },
        b: { id: HATCHED_B_ID, title: 'Portfolio photo' },
        label: 'financement',
        justification: 'La mission finance le portfolio',
        origin: 'ai',
        status: 'suggested',
        createdAt: '2026-09-28T10:00:00.000Z'
      }
    ],
    categories: CATEGORIES,
    highlighted: null,
    blocks: [],
    steps: [],
    io: [],
    seeds: []
  }
}

export function emptyCanvasView(): IdeasCanvasView {
  return {
    counts: { raw: 0, developing: 0, hatched: 0 },
    ideas: [],
    links: [],
    categories: CATEGORIES,
    highlighted: null,
    blocks: [],
    steps: [],
    io: [],
    seeds: []
  }
}
