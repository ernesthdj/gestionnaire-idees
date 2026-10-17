import { describe, expect, it } from 'vitest'
import { parseTaskFile } from '../../../src/main/domain/workflow/parseTaskFile'
import { buildSpec } from '../../../src/main/domain/workflow/specStatus'
import { parseTasks } from '../../../src/main/domain/workflow/parseTasks'
import { workflowInput } from '../../../src/main/domain/widgets/structureInputs'
import { resolveWorkflowRef } from '../../../src/main/domain/widgets/workflowRef'
import type { WorkflowView } from '../../../src/shared/ipc/workflow'

const G = '00000000-0000-4000-8000-0000000000a1'

const view = (): WorkflowView => {
  const email = parseTaskFile(
    'docs/TACHES-EMAIL.md',
    ['# Tâches — E-mail', '## Rappels J+3 / J+7', '- [ ] T004 Écran des rappels', '- [ ] T005 Envoi programmé'].join(
      '\n'
    )
  )
  const visuel = parseTaskFile(
    'docs/TACHES-VISUEL.md',
    ['# Tâches — Visuel', '## Lot 1', '- [ ] T004 Forme'].join('\n')
  )
  const spec = buildSpec({
    dir: 'specs/017-reprise',
    spec: null,
    tasks: parseTasks('- [ ] T010 [US2] Explorateur\n').tasks,
    partial: false
  })
  return { genesisId: G, specs: [spec], taskFiles: [email, visuel] } as unknown as WorkflowView
}

describe('nœud du Workflow désigné par un repère lisible (spec 026 D10)', () => {
  it('should_find_a_lot_by_its_title_and_a_task_by_its_id_and_file', () => {
    const lot = resolveWorkflowRef(view(), 'Rappels J+3 / J+7')
    expect(lot.key).not.toBeNull()
    expect(workflowInput(view(), lot.key ?? '')).toMatchObject({ node: 'group', title: 'Rappels J+3 / J+7' })
    const task = resolveWorkflowRef(view(), 'T004 docs/TACHES-EMAIL.md')
    expect(workflowInput(view(), task.key ?? '')).toMatchObject({ node: 'task', title: 'Écran des rappels' })
    const file = resolveWorkflowRef(view(), 'docs/TACHES-VISUEL.md')
    expect(workflowInput(view(), file.key ?? '')).toMatchObject({ node: 'file', title: 'Tâches — Visuel' })
    // Spec Kit : la tâche par son identifiant (unique ici), la spec par son numéro.
    expect(workflowInput(view(), resolveWorkflowRef(view(), 't010').key ?? '')).toMatchObject({ node: 'task' })
    expect(workflowInput(view(), resolveWorkflowRef(view(), 'spec 017').key ?? '')).toMatchObject({ node: 'spec' })
  })

  it('should_list_the_candidates_when_a_task_id_exists_in_two_files', () => {
    const result = resolveWorkflowRef(view(), 'T004')
    expect(result).toMatchObject({ key: null, reason: 'ambigu' })
    expect(result.key === null ? result.candidates : []).toHaveLength(2)
  })

  it('should_accept_a_unique_title_start_and_list_every_node_when_nothing_matches', () => {
    expect(resolveWorkflowRef(view(), 'rappels').key).not.toBeNull()
    const none = resolveWorkflowRef(view(), 'Paiement en ligne')
    expect(none).toMatchObject({ key: null, reason: 'inconnu' })
    expect(none.key === null ? none.candidates.some((label) => label.includes('Rappels J+3')) : false).toBe(true)
  })
})
