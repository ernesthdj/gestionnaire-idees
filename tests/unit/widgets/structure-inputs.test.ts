import { describe, expect, it } from 'vitest'
import { parseTaskFile } from '../../../src/main/domain/workflow/parseTaskFile'
import { buildSpec } from '../../../src/main/domain/workflow/specStatus'
import { parseTasks } from '../../../src/main/domain/workflow/parseTasks'
import { elementInput, workflowInput } from '../../../src/main/domain/widgets/structureInputs'
import { EMPTY_SHEET } from '../../../src/main/domain/conversation/sheet'
import type { WorkflowView } from '../../../src/shared/ipc/workflow'

const G = '00000000-0000-4000-8000-0000000000a1'

describe('entrées tirées de la structure et du Workflow (spec 023 D24)', () => {
  it('should_give_an_element_with_its_parents_from_the_top', () => {
    const element = (id: string, parentId: string, title: string, type = 'module') => ({
      id,
      genesisId: G,
      parentId,
      type,
      title,
      content: `Résumé de ${title}`,
      paths: [`src/${id}`],
      sheet: EMPTY_SHEET
    })
    const elements = [element('app', G, 'Application'), element('ecran', 'app', 'Écran principal', 'component')]
    expect(elementInput(elements, 'ecran')).toMatchObject({
      kind: 'element',
      title: 'Écran principal',
      type: 'component',
      summary: 'Résumé de Écran principal',
      paths: ['src/ecran'],
      path: [{ id: 'app', title: 'Application', type: 'module' }]
    })
    expect(elementInput(elements, 'disparu')).toBeUndefined()
  })

  it('should_find_a_task_file_node_by_its_map_key_and_read_its_tasks', () => {
    const file = parseTaskFile(
      'docs/USER-STORIES.md',
      ['# User Stories', '## Auth', '### Inscription', '- [x] Compte créé', '- [~] Hachage dans `app/User.php`'].join(
        '\n'
      )
    )
    const spec = buildSpec({
      dir: 'specs/001-demo',
      spec: null,
      tasks: parseTasks('- [ ] T001 [US1] Vue dans `src/vue.ts`\n').tasks,
      partial: false
    })
    const view = { genesisId: G, specs: [spec], taskFiles: [file] } as unknown as WorkflowView
    const lot = file.lots[0]
    const group = lot?.groups[0]
    const task = group?.tasks[1]
    expect(workflowInput(view, `wf:${G}:tfile:${file.key}`)).toMatchObject({ node: 'file', title: 'User Stories' })
    expect(workflowInput(view, `wf:${G}:tgroup:${group?.key}`)).toMatchObject({
      node: 'group',
      title: 'Inscription',
      section: 'Auth',
      file: 'docs/USER-STORIES.md',
      tasks: [
        { text: 'Compte créé', state: 'done' },
        { text: 'Hachage dans `app/User.php`', state: 'doing' }
      ]
    })
    expect(workflowInput(view, `wf:${G}:ttask:${task?.key}`)).toMatchObject({
      node: 'task',
      state: 'doing',
      section: 'Inscription',
      files: ['app/User.php']
    })
    expect(workflowInput(view, `wf:${G}:task:001:T001`)).toMatchObject({
      node: 'task',
      file: 'specs/001-demo/tasks.md',
      files: ['src/vue.ts']
    })
    expect(workflowInput(view, `wf:${G}:story:001:1`)).toMatchObject({ node: 'story', state: 'planned' })
    // Clé d'un autre projet, nœud disparu, sorte non branchable : rien.
    expect(
      workflowInput(view, `wf:${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}:tfile:${file.key}`)
    ).toBeUndefined()
    expect(workflowInput(view, `wf:${G}:ttask:inconnue`)).toBeUndefined()
    expect(workflowInput(view, `wf:${G}:branch:active`)).toBeUndefined()
  })
})
