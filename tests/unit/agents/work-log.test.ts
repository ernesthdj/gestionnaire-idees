import { describe, expect, it } from 'vitest'
import { refusalsOf, workFilesOf } from '../../../src/main/application/agents/PipelineEngine'

describe('bilan des fichiers d’une passe d’agent (L1o D18)', () => {
  it('should_read_added_modified_and_deleted_files_when_parsing_git_name_status', () => {
    const output = ['A', 'src/tri.ts', 'M', 'src/liste.ts', 'D', 'src/ancien.ts', ''].join('\0')
    expect(workFilesOf(output)).toEqual([
      { path: 'src/tri.ts', status: 'added' },
      { path: 'src/liste.ts', status: 'modified' },
      { path: 'src/ancien.ts', status: 'deleted' }
    ])
  })

  it('should_give_nothing_when_the_commit_touches_no_file', () => {
    expect(workFilesOf('')).toEqual([])
  })

  it('should_count_each_refused_tool_once_and_ignore_other_errors_when_reading_the_stream', () => {
    const refused = refusalsOf()
    refused.see({ kind: 'toolResult', id: 'a', isError: true, text: 'Claude requested permissions to write to x' })
    refused.see({ kind: 'toolResult', id: 'a', isError: true, text: 'Claude requested permissions to write to x' })
    refused.see({ kind: 'permissionDenied', id: 'b', message: 'refusé' })
    refused.see({ kind: 'toolResult', id: 'c', isError: true, text: 'File not found' })
    refused.see({ kind: 'toolResult', id: 'd', isError: false, text: 'ok' })
    expect(refused.count()).toBe(2)
  })
})
