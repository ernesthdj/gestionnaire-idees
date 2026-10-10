import { describe, expect, it } from 'vitest'
import { conversationDirs } from '../../../src/main/domain/conversation/workingDirs'

describe('dossiers d’une conversation (spec 024 D19)', () => {
  it('should_work_in_the_canvas_project_when_the_genesis_has_no_folder', () => {
    expect(conversationDirs({ kind: 'root', linked: null, project: 'C:/PID' })).toEqual({ cwd: 'C:/PID', extra: null })
  })

  it('should_add_the_linked_folder_to_the_canvas_project_when_the_genesis_points_elsewhere', () => {
    expect(conversationDirs({ kind: 'root', linked: 'C:/autre', project: 'C:/PID' })).toEqual({
      cwd: 'C:/PID',
      extra: 'C:/autre'
    })
  })

  it('should_work_in_the_genesis_folder_with_the_canvas_project_in_addition_for_a_step_or_an_element', () => {
    for (const kind of ['step', 'element']) {
      expect(conversationDirs({ kind, linked: 'C:/autre', project: 'C:/PID' })).toEqual({
        cwd: 'C:/autre',
        extra: 'C:/PID'
      })
    }
  })

  it('should_open_a_single_folder_when_the_linked_folder_is_the_canvas_project', () => {
    expect(conversationDirs({ kind: 'root', linked: 'c:\\PID\\', project: 'C:/PID' })).toEqual({
      cwd: 'C:/PID',
      extra: null
    })
  })

  it('should_keep_the_linked_folder_alone_when_the_canvas_has_no_folder', () => {
    expect(conversationDirs({ kind: 'root', linked: 'C:/autre', project: null })).toEqual({
      cwd: 'C:/autre',
      extra: null
    })
    expect(conversationDirs({ kind: 'root', linked: null, project: null })).toEqual({ cwd: null, extra: null })
  })
})
