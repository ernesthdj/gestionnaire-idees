import { describe, expect, it } from 'vitest'
import {
  close,
  closeReader,
  closeRepo,
  EMPTY_SIDE_PANEL,
  openAgents,
  openChat,
  openReader,
  openRepo,
  openWorkflowChat,
  repoGenesisId,
  requestFocus,
  selectAgent,
  shownAgent,
  shownChatId,
  shownNodeId,
  show,
  syncWithView,
  TAB_TITLE_MAX,
  type ChatTabInput
} from '../../../src/renderer/src/canvas/side/sidePanelStore'

const chat = (id: string, title = `Nœud ${id}`): ChatTabInput => ({
  nodeId: id,
  neuronId: id,
  title,
  kindLabel: 'Idée'
})
const keys = (state: { tabs: readonly { key: string }[] }): string[] => state.tabs.map((tab) => tab.key)

describe('sidePanelStore (spec 027)', () => {
  it('should_add_and_show_a_tab_without_duplicate_when_a_chat_is_opened_twice', () => {
    let state = openChat(EMPTY_SIDE_PANEL, chat('a'))
    state = openChat(state, chat('b'))
    expect(keys(state)).toEqual(['a', 'b'])
    expect(state.shownKey).toBe('b')
    state = openChat(state, chat('a'))
    expect(keys(state)).toEqual(['a', 'b'])
    expect(state.shownKey).toBe('a')
  })

  it('should_truncate_the_title_when_it_is_too_long', () => {
    const state = openChat(EMPTY_SIDE_PANEL, chat('a', 'x'.repeat(500)))
    expect(state.tabs[0]?.title).toHaveLength(TAB_TITLE_MAX)
  })

  it('should_open_a_workflow_tab_keyed_by_the_task_when_a_task_is_discussed', () => {
    const state = openWorkflowChat(EMPTY_SIDE_PANEL, {
      nodeId: 'wf:g:task:1',
      genesisId: 'g',
      title: 'T001',
      kindLabel: 'Tâche'
    })
    expect(state.tabs[0]).toMatchObject({ kind: 'workflowChat', genesisId: 'g', reader: null })
    expect(shownChatId(state)).toBe('wf:g:task:1')
  })

  it('should_show_the_reader_in_the_node_tab_when_a_file_is_opened', () => {
    let state = openChat(EMPTY_SIDE_PANEL, chat('e'))
    state = openReader(state, chat('e'), { source: 'element', path: 'src/a.ts', tab: 'file', elementId: 'e' })
    expect(keys(state)).toEqual(['e'])
    expect(state.tabs[0]).toMatchObject({ reader: { path: 'src/a.ts', elementId: 'e' } })
    expect(shownChatId(state)).toBeNull()
    state = closeReader(state, 'e')
    expect(state.tabs[0]).toMatchObject({ reader: null })
    expect(shownChatId(state)).toBe('e')
  })

  it('should_close_the_tab_when_a_reader_only_tab_goes_back', () => {
    let state = openReader(
      EMPTY_SIDE_PANEL,
      { nodeId: 'document-d', neuronId: null, title: 'Doc', kindLabel: 'Document' },
      { source: 'document', path: 'd', tab: 'file' }
    )
    expect(keys(state)).toEqual(['document-d'])
    state = closeReader(state, 'document-d')
    expect(state.tabs).toEqual([])
    expect(state.shownKey).toBeNull()
  })

  it('should_show_the_right_then_left_neighbour_when_the_shown_tab_is_closed', () => {
    let state = ['a', 'b', 'c'].reduce((next, id) => openChat(next, chat(id)), EMPTY_SIDE_PANEL)
    state = show(state, 'b')
    state = close(state, 'b')
    expect(state.shownKey).toBe('c')
    state = close(state, 'c')
    expect(state.shownKey).toBe('a')
    state = close(state, 'a')
    expect(state.shownKey).toBeNull()
  })

  it('should_keep_the_shown_tab_when_another_tab_is_closed', () => {
    let state = openChat(openChat(EMPTY_SIDE_PANEL, chat('a')), chat('b'))
    state = close(state, 'a')
    expect(state.shownKey).toBe('b')
  })

  it('should_keep_a_single_repo_tab_when_the_repo_is_opened_for_another_genesis', () => {
    let state = openChat(EMPTY_SIDE_PANEL, chat('a'))
    state = openRepo(state, 'g1')
    state = openRepo(state, 'g2')
    expect(keys(state)).toEqual(['a', 'repo:g2'])
    expect(repoGenesisId(state)).toBe('g2')
    expect(shownNodeId(state)).toBeNull()
    state = closeRepo(state)
    expect(keys(state)).toEqual(['a'])
    expect(state.shownKey).toBe('a')
  })

  it('should_close_only_missing_node_tabs_and_retitle_others_when_the_view_changes', () => {
    let state = openChat(openChat(EMPTY_SIDE_PANEL, chat('a')), chat('b'))
    state = openWorkflowChat(state, { nodeId: 'wf:g:x', genesisId: 'g', title: 'T', kindLabel: 'Tâche' })
    state = openRepo(state, 'g')
    // Agents d'une tâche du Workflow (L1o D14) : le nœud vient des fichiers, son volet reste.
    state = openAgents(state, { nodeId: 'wf:g:ttask:t1', genesisId: 'g', title: 'T1', kindLabel: 'Agents' })
    const labels = new Map([['a', { title: 'A renommé', kindLabel: 'Étape' }]])
    state = syncWithView(state, labels, new Set(['a']))
    expect(keys(state)).toEqual(['a', 'wf:g:x', 'repo:g', state.tabs[3]?.key])
    expect(state.tabs[3]).toMatchObject({ kind: 'agents', nodeId: 'wf:g:ttask:t1' })
    expect(state.tabs[0]).toMatchObject({ title: 'A renommé', kindLabel: 'Étape' })
  })

  it('should_close_nothing_when_the_view_is_filtered', () => {
    const state = syncWithView(openChat(EMPTY_SIDE_PANEL, chat('a')), new Map())
    expect(keys(state)).toEqual(['a'])
  })

  it('should_give_a_new_nonce_when_focus_is_requested_twice', () => {
    const first = requestFocus(EMPTY_SIDE_PANEL, 'a')
    const second = requestFocus(first, 'a')
    expect(second.focus?.nodeId).toBe('a')
    expect(second.focus?.nonce).not.toBe(first.focus?.nonce)
  })

  it('should_open_one_agents_tab_per_node_and_keep_the_chosen_agent_when_reopened_without_one', () => {
    const input = { nodeId: 'n', genesisId: 'g', title: '◇ Tri', kindLabel: 'Agents' }
    let state = openAgents(EMPTY_SIDE_PANEL, { ...input, agentId: 'back' })
    expect(state.tabs[0]).toMatchObject({ kind: 'agents', key: 'agents:n', agentId: 'back' })
    expect(shownAgent(state)).toEqual({ hostId: 'n', agentId: 'back' })
    state = openAgents(openChat(state, chat('x')), input)
    expect(keys(state)).toEqual(['agents:n', 'x'])
    expect(state.shownKey).toBe('agents:n')
    expect(state.tabs[0]).toMatchObject({ agentId: 'back' })
    state = selectAgent(state, 'n', null)
    expect(shownAgent(state)).toEqual({ hostId: 'n', agentId: null })
    expect(shownAgent(show(state, 'x'))).toBeNull()
  })

  it('should_have_no_conversation_and_no_reader_in_an_agents_tab', () => {
    let state = openAgents(EMPTY_SIDE_PANEL, { nodeId: 'n', genesisId: 'g', title: '◇ Tri', kindLabel: 'Agents' })
    expect(shownChatId(state)).toBeNull()
    expect(shownNodeId(state)).toBeNull()
    expect(closeReader(state, 'agents:n')).toBe(state)
    state = openReader(state, chat('n'), { source: 'element', path: 'a.ts', tab: 'file', elementId: 'n' })
    // Le lecteur s'ouvre dans l'onglet de conversation du nœud, jamais dans celui des agents.
    expect(keys(state)).toContain('agents:n')
    expect(state.tabs.find((tab) => tab.key === 'agents:n')).not.toHaveProperty('reader')
  })

  it('should_follow_the_node_title_and_close_the_agents_tab_when_the_node_disappears', () => {
    let state = openAgents(EMPTY_SIDE_PANEL, { nodeId: 'n', genesisId: 'g', title: '◇ Ancien', kindLabel: 'Agents' })
    state = syncWithView(state, new Map([['n', { title: 'Nouveau', kindLabel: 'Module' }]]), new Set(['n']))
    expect(state.tabs[0]).toMatchObject({ title: '◇ Nouveau', kindLabel: 'Module' })
    expect(syncWithView(state, new Map(), new Set()).tabs).toEqual([])
  })
})
