import { describe, expect, it } from 'vitest'
import { workflowGaps, workflowUpdatePrompt } from '../../../src/renderer/src/canvas/workflow/updatePrompt'
import type { WorkflowView } from '../../../src/shared/ipc/workflow'

const doc = (name: string, maturity: 'complet' | 'suffisant' | null, taskPaths: string[] = []) => ({
  name,
  level: 1,
  title: name,
  family: null,
  coveredBy: [],
  parent: null,
  maturity,
  taskPaths
})
const file = (path: string) => ({ key: path, path, title: path, tasks: [], lots: [], done: 0, total: 1 })

const view = (patch: Partial<Record<'brainstorm' | 'taskFiles' | 'specs', unknown[]>>): WorkflowView =>
  ({ genesisId: 'g', brainstorm: [], taskFiles: [], specs: [], ...patch }) as unknown as WorkflowView

describe('mettre à jour le Workflow d’un ancien projet (spec 032 D17)', () => {
  it('should_list_docs_without_header_and_task_files_left_as_sketches_when_diagnosing', () => {
    const gaps = workflowGaps(
      view({
        brainstorm: [
          doc('L1a-ancien.md', null),
          doc('L1b-complet.md', 'complet', ['docs/TACHES-B.md']),
          doc('L1c-suffisant.md', 'suffisant', ['docs/TACHES-C.md'])
        ],
        taskFiles: [file('docs/TACHES-B.md'), file('docs/TACHES-C.md'), file('docs/TODO.md')]
      })
    )
    expect(gaps).toEqual({
      docsWithoutHeader: ['L1a-ancien.md'],
      sketchedFiles: ['docs/TACHES-C.md', 'docs/TODO.md'],
      noTasks: false
    })
  })

  it('should_say_what_is_missing_and_forbid_code_changes_when_writing_the_prompt', () => {
    const prompt = workflowUpdatePrompt(view({ brainstorm: [doc('L1a-ancien.md', null)] }))
    expect(prompt).toContain('Ne touche pas au code et n’invente rien')
    expect(prompt).toContain('Brainstorms sans en-tête (ni maturité ni tâches) : L1a-ancien.md.')
    expect(prompt).toContain('Aucun fichier de tâches ni aucune spec')
    expect(prompt).toContain('docs/TACHES-<Sujet>.md')
    expect(prompt).toContain('dis quelle tâche est la prochaine')
  })

  it('should_only_ask_to_check_the_boxes_when_nothing_is_missing', () => {
    const prompt = workflowUpdatePrompt(
      view({ brainstorm: [doc('L1b.md', 'complet', ['docs/TACHES-B.md'])], taskFiles: [file('docs/TACHES-B.md')] })
    )
    expect(prompt).toContain('L’app ne voit rien de manquant')
  })
})
