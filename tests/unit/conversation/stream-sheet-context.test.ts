import { describe, expect, it } from 'vitest'
import { contextBlock, CONTEXT_MAX_CHARS, withContext } from '../../../src/main/domain/conversation/contextBlock'
import { EMPTY_SHEET, mergeSheet, readSheet, sheetMarkdown } from '../../../src/main/domain/conversation/sheet'
import { parseStreamLine, toolLabel } from '../../../src/main/domain/conversation/streamEvents'

const line = (value: unknown): string => JSON.stringify(value)

describe('flux stream-json du CLI', () => {
  it('should_read_the_session_and_auth_source_from_init', () => {
    expect(
      parseStreamLine(line({ type: 'system', subtype: 'init', session_id: 's1', model: 'm', apiKeySource: 'none' }))
    ).toEqual([{ kind: 'init', sessionId: 's1', model: 'm', apiKeySource: 'none' }])
  })

  it('should_emit_only_text_deltas_and_ignore_thinking', () => {
    const text = {
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Bon' } }
    }
    const thinking = {
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'hmm' } }
    }
    expect(parseStreamLine(line(text))).toEqual([{ kind: 'delta', text: 'Bon' }])
    expect(parseStreamLine(line(thinking))).toEqual([])
  })

  it('should_report_tool_uses_from_assistant_messages', () => {
    const message = {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Je note.' },
          { type: 'tool_use', name: 'mcp__brainstormer__fiche_ecrire', input: {} }
        ]
      }
    }
    expect(parseStreamLine(line(message))).toEqual([{ kind: 'tool', name: 'mcp__brainstormer__fiche_ecrire' }])
    expect(toolLabel('mcp__brainstormer__fiche_ecrire')).toBe('fiche mise à jour')
    expect(toolLabel('WebSearch')).toBe('recherche web')
  })

  it('should_read_quota_and_results', () => {
    expect(
      parseStreamLine(
        line({
          type: 'rate_limit_event',
          rate_limit_info: { status: 'allowed_warning', utilization: 0.85, resetsAt: 9 }
        })
      )
    ).toEqual([{ kind: 'quota', status: 'allowed_warning', utilization: 0.85, resetsAt: 9, fiveHour: null, sevenDay: null }])
    expect(
      parseStreamLine(line({ type: 'result', subtype: 'success', is_error: false, result: 'Salut', session_id: 's1' }))
    ).toMatchObject([{ kind: 'result', ok: true, text: 'Salut', sessionId: 's1', usage: { inputTokens: 0 } }])
    expect(parseStreamLine(line({ type: 'result', subtype: 'error_during_execution', is_error: true }))).toEqual([
      expect.objectContaining({ kind: 'result', ok: false, text: 'La conversation a échoué.', sessionId: null })
    ])
  })

  it('should_ignore_hooks_and_invalid_lines', () => {
    expect(parseStreamLine(line({ type: 'system', subtype: 'hook_started' }))).toEqual([])
    expect(parseStreamLine('pas du json')).toEqual([])
  })
})

describe('fiche du neurone', () => {
  it('should_replace_only_the_given_sections', () => {
    const sheet = mergeSheet(EMPTY_SHEET, { resume: 'Studio photo', decisions: ['Lieu : Liège'] })
    expect(sheet).toMatchObject({ resume: 'Studio photo', decisions: ['Lieu : Liège'], manques: [] })
    expect(mergeSheet(sheet ?? EMPTY_SHEET, { manques: ['Budget'] })).toMatchObject({
      decisions: ['Lieu : Liège'],
      manques: ['Budget']
    })
  })

  it('should_refuse_a_sheet_over_the_limit', () => {
    const many = Array.from({ length: 30 }, () => 'x'.repeat(500))
    expect(mergeSheet(EMPTY_SHEET, { points_cles: many })).toBeNull()
  })

  it('should_read_a_damaged_sheet_as_empty', () => {
    expect(readSheet('{oops')).toEqual(EMPTY_SHEET)
    expect(readSheet(null)).toEqual(EMPTY_SHEET)
  })

  it('should_render_the_sheet_as_markdown', () => {
    const text = sheetMarkdown({ ...EMPTY_SHEET, resume: 'R', decisions: ['D1'] })
    expect(text).toContain('Résumé : R')
    expect(text).toContain('Décisions :\n- D1')
  })
})

describe('contexte joint', () => {
  const neuron = {
    id: 'n1',
    title: 'Ouvrir un studio photo',
    content: null,
    sheet: { ...EMPTY_SHEET, decisions: ['Lieu : Liège'] },
    maturity: null,
    resumed: false
  }

  it('should_tell_claude_where_it_is_and_what_is_already_known', () => {
    const block = contextBlock(neuron)
    expect(block).toContain('genesis « Ouvrir un studio photo »')
    expect(block).toContain('Lieu : Liège')
    expect(block).toContain('Nouvelle conversation')
    expect(withContext(neuron, 'Salut')).toMatch(/<\/contexte_brainstormer>\n\nSalut$/)
  })

  it('should_stay_within_the_limit', () => {
    const long = { ...neuron, content: 'x'.repeat(30_000) }
    expect(contextBlock(long).length).toBeLessThanOrEqual(CONTEXT_MAX_CHARS)
  })
})
