import { describe, expect, it } from 'vitest'
import { citedPaths, parseTasks } from '../../src/main/domain/workflow/parseTasks'
import { WORKFLOW_LIMITS } from '../../src/main/domain/workflow/limits'

// Extraits réels (specs 017 et 022) et variantes.
const TASKS = `## Phase 1 — Mise en place
- [x] T001 Annoncer puis installer \`lucide-react\` (ISC, D12) : noter dans \`docs/JOURNAL.md\`
- [x] T004a [US1] Sous-tâche suffixée dans \`src/sub.ts\`
- [X] T004 [P] Pur : \`src/renderer/src/canvas/living/rhythm.ts\` + \`tests/unit/living-rhythm.test.ts\`
- [ ] T032 [P] [US2] Nœuds de skills in src/renderer/src/skills/SkillNodes.tsx.
- [ ] T040 [US4] Blocs : C:/Users/x/secret.txt, /etc/passwd, ../outside.ts, https://example.com/a.js
  - [ ] T050 [US3] tâche indentée dans \`src/x/y.ts\`
- [ ] sans identifiant
- [ ] T001 doublon ignoré
`

describe('parseTasks', () => {
  it('should_read_id_check_story_text_and_files_when_tasks_use_the_spec_kit_format', () => {
    const { tasks, truncated } = parseTasks(TASKS)
    expect(truncated).toBe(false)
    expect(tasks.map((task) => [task.id, task.done, task.story])).toEqual([
      ['T001', true, null],
      ['T004a', true, 1],
      ['T004', true, null],
      ['T032', false, 2],
      ['T040', false, 4],
      ['T050', false, 3]
    ])
    expect(tasks[2]?.text).toBe('Pur : `src/renderer/src/canvas/living/rhythm.ts` + `tests/unit/living-rhythm.test.ts`')
    expect(tasks[2]?.files).toEqual(['src/renderer/src/canvas/living/rhythm.ts', 'tests/unit/living-rhythm.test.ts'])
    expect(tasks[3]?.files).toEqual(['src/renderer/src/skills/SkillNodes.tsx'])
  })

  it('should_reject_absolute_parent_and_url_paths_when_extracting_cited_files', () => {
    const { tasks } = parseTasks(TASKS)
    expect(tasks[4]?.files).toEqual([])
  })

  it('should_stop_and_flag_truncation_when_tasks_exceed_the_limit', () => {
    const many = Array.from({ length: WORKFLOW_LIMITS.tasksPerSpec + 5 }, (_, index) => `- [ ] T${1000 + index} tâche`)
    const { tasks, truncated } = parseTasks(many.join('\n'))
    expect(tasks).toHaveLength(WORKFLOW_LIMITS.tasksPerSpec)
    expect(truncated).toBe(true)
  })
})

describe('citedPaths', () => {
  it('should_dedupe_ignore_folders_and_cap_paths_when_a_text_cites_many', () => {
    expect(citedPaths('`src/a.ts`, src/a.ts et src/folder/ puis docs/README.md.')).toEqual([
      'src/a.ts',
      'docs/README.md'
    ])
    const lots = Array.from({ length: 30 }, (_, index) => `src/f${index}.ts`).join(' ')
    expect(citedPaths(lots)).toHaveLength(WORKFLOW_LIMITS.pathsPerTask)
  })
})
