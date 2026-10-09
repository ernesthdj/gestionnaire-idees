import { describe, expect, it } from 'vitest'
import { decorateTasks } from '../../../src/renderer/src/canvas/workflow/tasksMarkdown'

describe('mise en valeur des tâches de tasks.md (spec 023 D13)', () => {
  it('should_bold_the_id_and_turn_tags_into_chips_when_a_line_is_a_task', () => {
    expect(decorateTasks('- [ ] T037 [US4] Test guidé US4')).toBe('- [ ] **T037** `US4` Test guidé US4')
    expect(decorateTasks('  - [X] T006 [P] [US1] Pur')).toBe('  - [X] **T006** `P` `US1` Pur')
    expect(decorateTasks('- [x] T1234 Sans étiquette')).toBe('- [x] **T1234** Sans étiquette')
  })

  it('should_leave_text_unchanged_when_a_line_is_not_a_task', () => {
    const text = [
      '## Phase 1',
      '- Une puce simple T037',
      '- [ ] Case sans identifiant [US1]',
      'Voir T037 [US4] dans le texte',
      '- [ ] T037x [US4] identifiant collé'
    ].join('\n')
    expect(decorateTasks(text)).toBe(text)
  })

  it('should_decorate_every_task_when_the_file_has_several_lines', () => {
    expect(decorateTasks('- [ ] T001 A\n- [ ] T002 [P] B')).toBe('- [ ] **T001** A\n- [ ] **T002** `P` B')
  })
})
