import { describe, expect, it } from 'vitest'
import { checkTask, hasTasks, parseTaskFile } from '../../src/main/domain/workflow/parseTaskFile'
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

describe('cocher une tâche à la fusion (L1o D23)', () => {
  const FILE = '# Tâches\r\n\r\n## Lot 1\r\n\r\n- [ ] T001 Trier\r\n- [~] T002 Filtrer\r\n- [x] T003 Chercher\r\n'
  const keyOf = (id: string): string =>
    parseTaskFile('docs/TACHES-X.md', FILE).lots[0]?.tasks.find((task) => task.id === id)?.key ?? ''

  it('should_check_only_the_task_of_that_key_and_keep_line_endings_when_it_is_open_or_in_progress', () => {
    const first = checkTask('docs/TACHES-X.md', FILE, keyOf('T001'))
    expect(first).toBe(FILE.replace('- [ ] T001', '- [x] T001'))
    expect(checkTask('docs/TACHES-X.md', FILE, keyOf('T002'))).toBe(FILE.replace('- [~] T002', '- [x] T002'))
  })

  it('should_return_null_when_the_task_is_already_checked_or_unknown', () => {
    expect(checkTask('docs/TACHES-X.md', FILE, keyOf('T003'))).toBeNull()
    expect(checkTask('docs/TACHES-X.md', FILE, 'inconnue')).toBeNull()
  })
})

describe('clé stable d’une tâche numérotée (spec 032 D21)', () => {
  const keyOf = (text: string, id: string): string | undefined =>
    [
      ...parseTaskFile('docs/TACHES-X.md', text).tasks,
      ...parseTaskFile('docs/TACHES-X.md', text).lots.flatMap((lot) => lot.tasks)
    ].find((task) => task.id === id)?.key

  it('should_keep_the_key_of_a_numbered_task_when_its_text_state_or_lot_changes', () => {
    const before = keyOf('# T\n\n## Lot 1\n\n- [ ] T002 Tâche planifiée\n', 'T002')
    // Le PO de Bike_cycle a réécrit la ligne en travaillant : la clé ne bouge pas.
    expect(keyOf('# T\n\n## Lot 1\n\n- [~] T002 Tâche planifiée (spec : x.md) · agent : Thor\n', 'T002')).toBe(before)
    expect(keyOf('# T\n\n## Autre lot\n\n- [x] T002 Autre texte\n', 'T002')).toBe(before)
  })

  it('should_give_the_former_text_key_as_legacy_and_keep_the_text_key_for_unnumbered_tasks', () => {
    const file = parseTaskFile('docs/TACHES-X.md', '# T\n\n## Lot\n\n- [ ] T002 Trier\n- [ ] Sans numéro\n')
    const [numbered, plain] = file.lots[0]?.tasks ?? []
    expect(numbered?.legacyKey).toBeDefined()
    expect(numbered?.legacyKey).not.toBe(numbered?.key)
    expect(plain?.legacyKey).toBeUndefined()
    // Deux tâches au même numéro restent distinctes.
    const twice = parseTaskFile('docs/TACHES-X.md', '# T\n\n## Lot\n\n- [ ] T002 A\n- [ ] T002 B\n')
    const keys = twice.lots[0]?.tasks.map((task) => task.key)
    expect(new Set(keys).size).toBe(2)
  })
})
