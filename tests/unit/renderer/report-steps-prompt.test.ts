import { describe, expect, it } from 'vitest'
import {
  brainstormSubject,
  newBrainstormPrompt,
  reportStepsPrompt,
  strayLabel
} from '../../../src/renderer/src/canvas/workflow/prompts'

describe('consignes de la barre : reporter dans les fichiers, nouveau brainstorm (spec 023 D23, D26, D28)', () => {
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

  it('should_build_the_new_brainstorm_prompt_from_a_cleaned_subject_on_one_line', () => {
    expect(brainstormSubject('  `Agents`\n« qui parlent »  ')).toBe('Agents qui parlent')
    expect(brainstormSubject(' \n ')).toBeNull()
    expect(brainstormSubject('x'.repeat(300))).toHaveLength(120)
    const prompt = newBrainstormPrompt('Agents qui parlent')
    expect(prompt).toContain('/brainstorm sur « Agents qui parlent »')
    expect(prompt).toContain('docs/brainstorm/')
    expect(prompt).toContain('Ne pose rien dans la carte de structure')
  })

  it('should_say_what_was_put_outside_the_workflow', () => {
    expect(strayLabel('workflow', 2, 0)).toBe('2 étapes générées masquées')
    expect(strayLabel('progression', 1, 0)).toBe('1 étape à reporter dans le Workflow')
    expect(strayLabel('architecture', 0, 1)).toBe('1 tâche ou décision à reporter dans le Workflow')
  })
})
