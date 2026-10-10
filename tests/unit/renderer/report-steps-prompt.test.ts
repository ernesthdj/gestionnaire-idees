import { describe, expect, it } from 'vitest'
import { reportStepsPrompt } from '../../../src/renderer/src/canvas/workflow/prompts'

describe('reporter les étapes nées en Workflow dans les fichiers (spec 023 D23)', () => {
  it('should_list_the_steps_in_order_and_hierarchy_and_ask_for_tasks_without_duplicates', () => {
    const prompt = reportStepsPrompt('g', [
      { id: 'b', parentId: 'g', title: 'Bootstrap', rank: 2 },
      { id: 'a', parentId: 'g', title: 'Racine du site', rank: 1 },
      { id: 'b1', parentId: 'b', title: 'Autoloader', rank: 1 }
    ])
    expect(prompt.split('\n').slice(1, 4)).toEqual(['- Racine du site', '- Bootstrap', '  - Autoloader'])
    expect(prompt).toContain('« - [ ] »')
    expect(prompt).toContain('sans créer de doublon')
  })
})
