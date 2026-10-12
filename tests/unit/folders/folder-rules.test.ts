import { describe, expect, it } from 'vitest'
import {
  FOLDER_FILE_MAX,
  isUnseen,
  mergeFolderFiles,
  pathKey,
  sortFolderFiles
} from '../../../src/main/domain/folders/folderRules'
import { folderFileKind, type FolderFileView, type FolderSource } from '../../../src/shared/ipc/folders'

const file = (path: string, source: FolderSource, updatedAt = '2026-10-12T10:00:00.000Z', unseen = false) =>
  ({
    path,
    name: path.split('/').pop() ?? path,
    kind: folderFileKind(path),
    source,
    updatedAt,
    unseen
  }) satisfies FolderFileView

describe('règles du dossier d’un nœud (spec 028 R1)', () => {
  it('should_sort_files_into_docs_code_and_others_when_reading_their_extension', () => {
    expect(
      ['cours.md', 'notes.TXT', 'plan.pdf', 'src/bilan.ts', 'App.cs', 'logo.png', 'Makefile'].map(folderFileKind)
    ).toEqual(['doc', 'doc', 'doc', 'code', 'code', 'other', 'other'])
  })

  it('should_keep_one_line_per_file_with_the_strongest_source_when_sources_overlap', () => {
    const merged = mergeFolderFiles([
      file('src/Bilan.ts', 'covered'),
      file('src/bilan.ts', 'conversation', '2026-10-12T11:00:00.000Z', true),
      file('docs/cours.md', 'manual'),
      file('docs/cours.md', 'document')
    ])
    expect(merged.map((entry) => [entry.path, entry.source, entry.unseen])).toEqual([
      ['src/bilan.ts', 'conversation', true],
      ['docs/cours.md', 'document', false]
    ])
  })

  it('should_keep_the_new_mark_when_a_weaker_source_was_written_by_claude', () => {
    const merged = mergeFolderFiles([file('a.md', 'document'), file('a.md', 'conversation', undefined, true)])
    expect(merged).toEqual([expect.objectContaining({ source: 'document', unseen: true })])
  })

  it('should_list_documents_first_then_the_most_recent_when_sorting', () => {
    const sorted = sortFolderFiles([
      file('b.ts', 'conversation', '2026-10-12T12:00:00.000Z'),
      file('old.md', 'document', '2026-10-01T00:00:00.000Z'),
      file('a.ts', 'conversation', '2026-10-12T12:00:00.000Z'),
      file('new.md', 'document', '2026-10-12T09:00:00.000Z')
    ])
    expect(sorted.map((entry) => entry.path)).toEqual(['new.md', 'old.md', 'a.ts', 'b.ts'])
  })

  it('should_put_doc_files_before_code_when_none_is_an_app_document', () => {
    const sorted = sortFolderFiles([file('src/a.ts', 'covered', ''), file('cours/cours.md', 'covered', '')])
    expect(sorted.map((entry) => entry.path)).toEqual(['cours/cours.md', 'src/a.ts'])
  })

  it('should_mark_as_new_only_what_claude_wrote_after_the_last_opening', () => {
    expect(isUnseen('2026-10-12T10:00:00.000Z', '2026-10-12T09:00:00.000Z')).toBe(true)
    expect(isUnseen('2026-10-12T08:00:00.000Z', '2026-10-12T09:00:00.000Z')).toBe(false)
    expect(isUnseen('2026-10-12T08:00:00.000Z', null)).toBe(true)
    expect(isUnseen(null, null)).toBe(false)
  })

  it('should_compare_paths_without_case_and_with_forward_slashes', () => {
    expect(pathKey('Src\\Bilan.TS')).toBe('src/bilan.ts')
    expect(FOLDER_FILE_MAX).toBe(500)
  })
})
