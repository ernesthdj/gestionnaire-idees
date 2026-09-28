import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isOutsideNature, REFERENCE_DIMENSIONS } from '../../../src/main/domain/neurons/nature'
import { createNeuronHarness, etendreReply, type NeuronHarness } from '../../support/neurons'

describe('dimensions de référence par nature (US5, analyse U1)', () => {
  it('should_recognize_reference_dimensions_ignoring_case_and_accents', () => {
    expect(isOutsideNature('Quand', 'action')).toBe(false)
    expect(isOutsideNature('source d’argent', 'action')).toBe(false)
    expect(isOutsideNature('criteres', 'reflection')).toBe(false)
    expect(isOutsideNature('pourquoi', 'action')).toBe(true)
    expect(isOutsideNature('couleur', 'reflection')).toBe(true)
  })

  describe('avec le moteur de croissance (IA simulée)', () => {
    let t: NeuronHarness
    beforeEach(() => {
      t = createNeuronHarness()
    })
    afterEach(() => t.dispose())

    it('should_send_the_new_nature_dimensions_after_the_user_changes_nature_mid_development', async () => {
      const root = await t.neurons.create({ text: 'Refaire mon portfolio', nature: 'reflection' })
      t.h.claude.enqueue(etendreReply(['Pourquoi maintenant ?', 'Quelles options ?', 'Quels critères ?']))
      const tree = (await t.growth.develop(root.id)).tree
      expect(t.h.anonymized.at(-1)).toContain(REFERENCE_DIMENSIONS.reflection.join(', '))

      const changed = t.neurons.update({ id: root.id, nature: 'action' })
      expect(changed).toMatchObject({ nature: 'action', natureSource: 'user' })
      t.h.claude.enqueue(etendreReply(['Pour quand ?']))
      await t.growth.answer({ extensionId: tree.extensions[0]?.id ?? '', answer: { text: 'Avant l’été' } })
      expect(t.h.anonymized.at(-1)).toContain(REFERENCE_DIMENSIONS.action.join(', '))
      expect(t.h.anonymized.at(-1)).toContain('Nature : Action')
    })

    it('should_flag_questions_outside_the_current_nature_without_removing_them', async () => {
      const root = await t.neurons.create({ text: 'Acheter un 2e écran', nature: 'action' })
      t.h.claude.enqueue({
        raw: {
          kind: 'extensions',
          extensions: [
            { question: 'Pour quand ?', quickReplies: [], dimension: 'quand' },
            { question: 'Quel budget ?', quickReplies: [], dimension: 'combien' },
            { question: 'Pourquoi en as-tu besoin ?', quickReplies: [], dimension: 'pourquoi' }
          ],
          suggestions: [],
          assessment: { level: 'insufficient', covered: [], missing: [] }
        }
      })
      const tree = (await t.growth.develop(root.id)).tree
      expect(tree.extensions.map((extension) => [extension.dimension, extension.outsideNature])).toEqual([
        ['quand', false],
        ['combien', false],
        ['pourquoi', true]
      ])
      // Changement de nature : le signalement suit la nouvelle orientation.
      t.neurons.update({ id: root.id, nature: 'reflection' })
      expect(t.growth.tree(root.id).extensions.find((e) => e.dimension === 'pourquoi')?.outsideNature).toBe(false)
    })
  })
})
