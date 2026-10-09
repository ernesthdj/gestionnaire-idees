import { describe, expect, it } from 'vitest'
import { hubAnomalies, journalHeadings } from '../../../src/main/domain/brainstorms/anomalies'
import { freeSlug } from '../../../src/main/application/brainstorms/BrainstormService'
import { EMPTY_VIEW_STATE, parseViewState } from '../../../src/shared/brainstorms/viewState'
import { BrainstormOpenInput, BrainstormScratchInput } from '../../../src/shared/ipc/brainstorms'

describe('règles du Project Manager (spec 024)', () => {
  it('should_report_sessions_and_git_state_only_when_there_is_something_to_say', () => {
    expect(hubAnomalies({ slug: 'a', hubSession: null, git: { files: 0, ahead: 0, behind: 0 } })).toEqual([])
    expect(hubAnomalies({ slug: 'a', hubSession: null, git: null })).toEqual([])
    expect(
      hubAnomalies({ slug: 'a', hubSession: { slug: 'a', since: 'hier' }, git: { files: 0, ahead: 0, behind: 3 } })
    ).toEqual([
      { kind: 'session_here', since: 'hier' },
      { kind: 'behind', count: 3 }
    ])
  })

  it('should_keep_the_latest_journal_headings_first', () => {
    const journal = ['# Journal', '### un', 'texte', '### deux', '#### pas un titre', '### trois'].join('\n')
    expect(journalHeadings(journal, 2)).toEqual(['trois', 'deux'])
    expect(journalHeadings('')).toEqual([])
  })

  it('should_read_a_valid_view_state_and_ignore_a_broken_one', () => {
    const state = { ...EMPTY_VIEW_STATE, viewport: { x: 1, y: 2, zoom: 1 } }
    expect(parseViewState(JSON.stringify(state))).toEqual(state)
    expect(parseViewState(null)).toBeNull()
    expect(parseViewState('{pas du json')).toBeNull()
    expect(parseViewState(JSON.stringify({ ...state, viewport: { x: 1, y: 2, zoom: 99 } }))).toBeNull()
    const tooMany = Array.from({ length: 21 }, (_, index) => ({
      id: `c${index}`,
      offset: { x: 0, y: 0 },
      sheet: false,
      side: null,
      pinned: false
    }))
    expect(parseViewState(JSON.stringify({ ...state, openCards: tooMany }))).toBeNull()
  })

  it('should_validate_the_open_and_scratch_inputs_at_the_boundary', () => {
    expect(BrainstormOpenInput.safeParse({ slug: 'alpha' }).success).toBe(true)
    expect(BrainstormOpenInput.safeParse({ id: 'pas-un-uuid' }).success).toBe(false)
    expect(BrainstormOpenInput.safeParse({ path: 'C:\\autre' }).success).toBe(false)
    const scratch = { name: 'X', slug: 'xx', description: '', type: 'Web App', github: false }
    expect(BrainstormScratchInput.safeParse(scratch).success).toBe(true)
    expect(BrainstormScratchInput.safeParse({ ...scratch, type: 'Inconnu' }).success).toBe(false)
    expect(BrainstormScratchInput.safeParse({ ...scratch, folder: 'C:\\x' }).success).toBe(false)
  })

  it('should_propose_a_free_slug_from_a_folder_name', () => {
    const taken = new Set(['mon-projet', 'mon-projet-2'])
    expect(freeSlug('Mon Projet', (slug) => taken.has(slug))).toBe('mon-projet-3')
    expect(freeSlug('Été', () => false)).toBe('ete')
  })
})
