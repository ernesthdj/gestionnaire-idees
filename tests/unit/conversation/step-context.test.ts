import { describe, expect, it } from 'vitest'
import { contextBlock, CONTEXT_MAX_CHARS } from '../../../src/main/domain/conversation/contextBlock'
import { EMPTY_SHEET } from '../../../src/main/domain/conversation/sheet'
import { rankLabel } from '../../../src/shared/plan/rankLabel'

const sheet = (decision: string) => ({ ...EMPTY_SHEET, decisions: [decision] })

describe('contexte hérité d’une étape (spec 011 US1)', () => {
  const step = {
    id: 's1',
    title: 'Visiter trois locaux',
    content: 'Avant de signer',
    sheet: sheet('Pas plus de 900 € de loyer'),
    maturity: null,
    resumed: false,
    step: {
      label: '②.1',
      path: [
        { title: 'Ouvrir un studio photo', label: null, sheet: sheet('Studio à Liège') },
        { title: 'Choisir le lieu', label: '②', sheet: sheet('Près de la gare') }
      ]
    }
  }

  it('should_give_the_sheets_of_the_genesis_and_of_every_node_of_the_path', () => {
    const block = contextBlock(step)
    expect(block).toContain('étape ②.1 « Visiter trois locaux »')
    expect(block).toContain('plan d’attaque de « Ouvrir un studio photo »')
    expect(block).toContain('Chemin : Ouvrir un studio photo › ② Choisir le lieu › ②.1 Visiter trois locaux.')
    expect(block).toContain('Studio à Liège')
    expect(block).toContain('Près de la gare')
    expect(block).toContain('Pas plus de 900 € de loyer')
  })

  it('should_tell_claude_not_to_write_in_a_locked_node', () => {
    expect(contextBlock({ ...step, locked: true })).toContain('Nœud VERROUILLÉ')
    expect(contextBlock(step)).not.toContain('VERROUILLÉ')
  })

  it('should_drop_the_middle_sheets_first_and_keep_the_genesis_parent_and_own_sheet_when_too_long', () => {
    const big = sheet('y'.repeat(400))
    const deep = {
      ...step,
      step: {
        label: '②.1.1.1',
        path: [
          { title: 'Genesis', label: null, sheet: sheet('Décision du genesis') },
          ...Array.from({ length: 2 }, (_, n) => ({
            title: `Milieu ${n}`,
            label: '②',
            sheet: { ...big, points_cles: Array.from({ length: 30 }, () => 'z'.repeat(480)) }
          })),
          { title: 'Parent', label: '②.1.1', sheet: sheet('Décision du parent') }
        ]
      }
    }
    const block = contextBlock(deep)
    expect(block.length).toBeLessThanOrEqual(CONTEXT_MAX_CHARS)
    expect(block).toContain('Décision du genesis')
    expect(block).toContain('Décision du parent')
    expect(block).toContain('Pas plus de 900 € de loyer')
    expect(block).not.toContain('Milieu 0')
  })

  it('should_label_ranks_with_a_circled_first_level_and_dotted_sublevels', () => {
    expect(rankLabel([2])).toBe('②')
    expect(rankLabel([2, 1])).toBe('②.1')
    expect(rankLabel([12, 3, 4])).toBe('⑫.3.4')
    expect(rankLabel([25])).toBe('25')
    expect(rankLabel([])).toBe('')
  })
})
