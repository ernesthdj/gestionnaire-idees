import type { Nature, TreeView } from '../../src/shared/ipc/neurons'
import { etendreReply, type NeuronHarness } from './neurons'

/** Plan « 2e écran » : condition « J'ai l'argent ? » (source s2 = réponse budget) et ses deux branches. */
export function screenPlan(extra: { amountCents?: number } = {}) {
  return {
    raw: {
      nodes: [
        { ref: 'c1', type: 'condition', title: 'J’ai l’argent ?', question: 'Budget prêt ?', sourceRefs: ['s2'] },
        {
          ref: 't1',
          type: 'task',
          title: 'Commander l’écran',
          parentRef: 'c1',
          branchLabel: 'Oui',
          sourceRefs: ['s1'],
          ...extra
        },
        {
          ref: 't2',
          type: 'task',
          title: 'Attendre la mission mariage',
          parentRef: 'c1',
          branchLabel: 'Non',
          sourceRefs: ['s3']
        },
        { ref: 't3', type: 'task', title: 'Installer l’écran', sourceRefs: ['s0'] }
      ],
      dependencies: [{ fromRef: 't1', toRef: 't3', kind: 'after_done' }],
      gaps: []
    }
  }
}

export const reflectionSummary = {
  raw: {
    keyPoints: [{ text: 'Le 35 mm suffit pour le reportage', sourceRefs: ['s1'] }],
    decisions: [{ text: 'Tester en location d’abord', sourceRefs: ['s2'] }],
    pros: [{ text: 'Plus discret', sourceRefs: ['s3'] }],
    cons: [{ text: 'Moins polyvalent', sourceRefs: ['s1'] }],
    openQuestions: [{ text: 'Revendre le 24-70 ?' }]
  }
}

/** Neurone développé avec 3 réponses : jauge « suffisant » (plancher E4 franchi). */
export async function readyRoot(
  t: NeuronHarness,
  nature: Nature = 'action',
  answers = ['Cette semaine', '250 €', 'Un 27 pouces']
): Promise<TreeView> {
  const root = await t.neurons.create({
    text: nature === 'action' ? 'Acheter un 2e écran' : 'Passer au 35 mm fixe ?',
    nature
  })
  t.h.claude.enqueue(etendreReply(['Pour quand ?', 'Quel budget ?', 'Quel modèle ?']))
  let tree = (await t.growth.develop(root.id)).tree
  for (const [index, text] of answers.entries()) {
    const extension = tree.extensions[0]
    t.h.claude.enqueue(etendreReply([], index === answers.length - 1 ? 'sufficient' : 'insufficient'))
    tree = (await t.growth.answer({ extensionId: extension?.id ?? '', answer: { text } })).tree
  }
  return tree
}
