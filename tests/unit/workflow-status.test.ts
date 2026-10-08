import { describe, expect, it } from 'vitest'
import type { TaskView } from '@shared/ipc/workflow'
import { parseSpec } from '../../src/main/domain/workflow/parseSpec'
import { buildSpec, specStatus } from '../../src/main/domain/workflow/specStatus'

const task = (id: string, done: boolean, story: number | null, files: string[] = []): TaskView => ({
  id,
  done,
  story,
  text: id,
  files
})

describe('specStatus', () => {
  it('should_compute_the_status_from_checkboxes_when_there_is_no_marker', () => {
    expect(specStatus(null, null)).toBe('specified')
    expect(specStatus(null, [])).toBe('planned')
    expect(specStatus(null, [task('T1', false, null)])).toBe('planned')
    expect(specStatus(null, [task('T1', true, null), task('T2', false, null)])).toBe('active')
    expect(specStatus(null, [task('T1', true, null)])).toBe('delivered')
  })

  it('should_prefer_the_marker_when_the_status_line_has_one', () => {
    expect(specStatus('delivered', [task('T1', false, null)])).toBe('delivered')
    expect(specStatus('paused', [task('T1', true, null), task('T2', false, null)])).toBe('paused')
    expect(specStatus('abandoned', null)).toBe('abandoned')
  })
})

describe('buildSpec', () => {
  const spec = parseSpec(
    '# Feature Specification: Démo\n**Status**: Livrée (2026-10-04)\n### User Story 1 — Voir (Priority: P1)\n### User Story 2 — Agir (Priority: P2)\n'
  )

  it('should_group_tasks_by_story_mark_delivered_stories_and_keep_the_socle_when_building_a_spec', () => {
    const view = buildSpec({
      dir: 'specs/023-demo',
      spec: { ...spec, marker: null, statusLine: null },
      tasks: [
        task('T001', true, null),
        task('T002', true, 1, ['src/a.ts']),
        task('T003', true, 1, ['src/a.ts', 'src/b.ts']),
        task('T004', false, 2),
        task('T005', false, 9)
      ],
      partial: false
    })
    expect(view).toMatchObject({ number: '023', title: 'Démo', status: 'active', done: 3, total: 5, partial: false })
    expect(view.socle.map((entry) => entry.id)).toEqual(['T001'])
    expect(
      view.stories.map((story) => [story.number, story.delivered, story.described, story.done, story.total])
    ).toEqual([
      [1, true, true, 2, 2],
      [2, false, true, 0, 1],
      [9, false, false, 0, 1]
    ])
    expect(view.stories[0]?.files).toEqual(['src/a.ts', 'src/b.ts'])
    expect(view.leftovers).toEqual([])
  })

  it('should_list_leftovers_when_a_spec_is_marked_delivered_with_unchecked_tasks', () => {
    const view = buildSpec({
      dir: 'specs/001-x',
      spec,
      tasks: [task('T1', true, 1), task('T2', false, 2)],
      partial: false
    })
    expect(view.status).toBe('delivered')
    expect(view.leftovers.map((entry) => entry.id)).toEqual(['T2'])
  })

  it('should_follow_the_spec_when_a_story_has_no_labelled_task', () => {
    const delivered = buildSpec({ dir: 'specs/004-x', spec, tasks: [task('T1', true, null)], partial: false })
    expect(delivered.stories.map((story) => story.delivered)).toEqual([true, true])
    const active = buildSpec({
      dir: 'specs/005-x',
      spec: { ...spec, marker: null },
      tasks: [task('T1', true, null), task('T2', false, null)],
      partial: false
    })
    expect(active.stories.map((story) => story.delivered)).toEqual([false, false])
  })

  it('should_fall_back_to_the_folder_name_and_flag_partial_when_spec_md_is_missing', () => {
    const view = buildSpec({ dir: 'specs/014-claude-libre', spec: null, tasks: null, partial: false })
    expect(view).toMatchObject({ number: '014', title: 'claude libre', status: 'specified', partial: true })
  })
})
