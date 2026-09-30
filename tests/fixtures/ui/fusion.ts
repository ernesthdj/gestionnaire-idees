import type { SynthesisView } from '../../../src/shared/ipc/neurons'
import { ROOT_ID } from './dive'

/** Aperçus FICTIFS : plan « 2e écran » (condition + 2 branches + dépendance) et synthèse de réflexion. */
export const PLAN_ID = '00000000-0000-4000-8000-00000000f001'
export const SUMMARY_ID = '00000000-0000-4000-8000-00000000f002'

const common = {
  rootId: ROOT_ID,
  status: 'proposed' as const,
  baseVersion: 4,
  instruction: null,
  forced: false,
  degraded: false,
  sources: {},
  createdAt: '2026-09-28T10:00:00.000Z'
}

export function planPreview(patch: Partial<SynthesisView> = {}): SynthesisView {
  return {
    ...common,
    id: PLAN_ID,
    type: 'action_plan',
    plan: {
      nodes: [
        { ref: 'c1', type: 'condition', title: 'J’ai l’argent ?', question: 'Budget prêt ?', sourceRefs: ['s2'] },
        {
          ref: 't1',
          type: 'task',
          title: 'Commander l’écran',
          parentRef: 'c1',
          branchLabel: 'Oui',
          amountCents: 25000,
          sourceRefs: ['s1']
        },
        { ref: 't2', type: 'task', title: 'Attendre la mission', parentRef: 'c1', branchLabel: 'Non', sourceRefs: [] },
        { ref: 't3', type: 'task', title: 'Installer l’écran', sourceRefs: [] }
      ],
      dependencies: [{ fromRef: 't1', toRef: 't3', kind: 'after_done' }],
      gaps: ['Taille exacte du bureau'],
      tools: [],
      toolsNote: 'Rien à outiller : le plan tient en trois tâches.'
    },
    ...patch
  } as SynthesisView
}

export function summaryPreview(): SynthesisView {
  return {
    ...common,
    id: SUMMARY_ID,
    type: 'reflection_summary',
    summary: {
      keyPoints: [{ text: 'Le 35 mm suffit pour le reportage', sourceRefs: [] }],
      decisions: [{ text: 'Tester en location', sourceRefs: [] }],
      pros: [{ text: 'Plus discret', sourceRefs: [] }],
      cons: [],
      openQuestions: [{ text: 'Revendre le 24-70 ?' }],
      tools: [],
      toolsNote: ''
    }
  }
}
