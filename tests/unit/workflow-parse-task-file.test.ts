import { describe, expect, it } from 'vitest'
import { hasTasks, parseTaskFile } from '../../src/main/domain/workflow/parseTaskFile'
import { parseTasks } from '../../src/main/domain/workflow/parseTasks'
import { WORKFLOW_KEY } from '../../src/shared/ipc/workflow'

const USER_STORIES = `# User Stories — PID

## Légende
Texte sans case.

## 1. Squelette sécurisé
### US-AUTH-01 — Inscription
- [x] Le compte est créé « en attente »
- [~] Mot de passe haché dans \`app/Models/User.php\`
  - [ ] Sous-critère indenté
### US-AUTH-02 — Vérification
- [ ] Lien expiré

## 2. Vitrine
- [ ] T010 Portfolio sans compte
\`\`\`md
- [ ] case d'exemple dans un bloc de code
\`\`\`
`

describe('fichier de tâches (spec 023 D20, D21)', () => {
  it('should_read_lots_groups_and_three_states_from_the_headings_of_the_file', () => {
    const file = parseTaskFile('docs/USER-STORIES.md', USER_STORIES)
    expect(file).toMatchObject({ path: 'docs/USER-STORIES.md', title: 'User Stories — PID', done: 1, total: 5 })
    expect(file.status).toBe('active')
    expect(file.lots.map((lot) => lot.title)).toEqual(['1. Squelette sécurisé', '2. Vitrine'])
    const [skeleton, vitrine] = file.lots
    expect(skeleton?.groups.map((group) => [group.title, group.done, group.total])).toEqual([
      ['US-AUTH-01 — Inscription', 1, 3],
      ['US-AUTH-02 — Vérification', 0, 1]
    ])
    expect(skeleton?.groups[0]?.tasks.map((task) => task.state)).toEqual(['done', 'doing', 'todo'])
    expect(skeleton?.groups[0]?.tasks[1]?.files).toEqual(['app/Models/User.php'])
    expect(vitrine?.tasks).toEqual([expect.objectContaining({ id: 'T010', text: 'Portfolio sans compte' })])
  })

  it('should_keep_the_same_keys_when_tasks_are_added_or_moved_in_the_file', () => {
    const before = parseTaskFile('docs/T.md', '## Lot\n- [ ] Un\n- [ ] Deux\n')
    const after = parseTaskFile('docs/T.md', '## Lot\n- [ ] Zéro\n- [ ] Deux\n- [x] Un\n')
    const keyOf = (file: typeof before, text: string): string | undefined =>
      file.lots[0]?.tasks.find((task) => task.text === text)?.key
    expect(keyOf(after, 'Un')).toBe(keyOf(before, 'Un'))
    expect(keyOf(after, 'Deux')).toBe(keyOf(before, 'Deux'))
    expect(before.lots[0]?.key).toBe(after.lots[0]?.key)
  })

  it('should_give_keys_that_fit_a_workflow_node_key', () => {
    const file = parseTaskFile('docs/USER-STORIES.md', USER_STORIES)
    const keys = [
      file.key,
      ...file.lots.flatMap((lot) => [lot.key, ...lot.groups.map((group) => group.key)]),
      ...file.lots.flatMap((lot) => [...lot.tasks, ...lot.groups.flatMap((group) => group.tasks)]).map((t) => t.key)
    ]
    for (const key of keys)
      expect(`wf:${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}:ttask:${key}`).toMatch(WORKFLOW_KEY)
  })

  it('should_tell_apart_two_tasks_with_the_same_text', () => {
    const file = parseTaskFile('T.md', '- [ ] Même texte\n- [ ] Même texte\n')
    const [first, second] = file.tasks
    expect(first?.key).not.toBe(second?.key)
  })

  it('should_name_the_file_after_its_path_and_drop_headings_without_tasks_when_it_has_no_title', () => {
    const file = parseTaskFile('TODO.md', '## Vide\ntexte\n### Rien\n- [ ] Seule\n')
    expect(file.title).toBe('TODO')
    expect(file.lots.map((lot) => [lot.title, lot.groups.map((group) => group.title)])).toEqual([['Vide', ['Rien']]])
    expect(file.status).toBe('planned')
  })

  it('should_recognize_a_task_file_only_with_a_checkbox_outside_code_blocks', () => {
    expect(hasTasks('# Doc\n- [x] fait\n')).toBe(true)
    expect(hasTasks('# Doc\n```\n- [ ] exemple\n```\n')).toBe(false)
    expect(hasTasks('# Doc\n- puce\n')).toBe(false)
  })

  it('should_read_a_task_in_progress_in_a_spec_kit_tasks_file', () => {
    const { tasks } = parseTasks('- [~] T001 [US1] En cours\n- [x] T002 Faite\n- [ ] T003 À faire\n')
    expect(tasks.map((task) => [task.id, task.state, task.done])).toEqual([
      ['T001', 'doing', false],
      ['T002', 'done', true],
      ['T003', 'todo', false]
    ])
  })
})
