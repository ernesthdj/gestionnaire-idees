import { describe, expect, it } from 'vitest'
import { highlight, parseHighlight, splitHighlightLines } from '../../../src/renderer/src/lib/highlight'

describe('coloration de la visionneuse (spec 013 R10)', () => {
  it('should_turn_highlight_output_into_a_tree_of_text_and_spans', () => {
    expect(parseHighlight('<span class="hljs-keyword">const</span> a = &lt;b&gt; &amp;&quot;&#x27;')).toEqual([
      { className: 'hljs-keyword', children: ['const'] },
      ' a = <b> &"\''
    ])
  })

  it('should_accept_nested_and_multi_class_spans_of_highlight_js', () => {
    expect(
      parseHighlight('<span class="hljs-title class_ inherited__"><span class="language-xml">x</span></span>')
    ).toEqual([
      { className: 'hljs-title class_ inherited__', children: [{ className: 'language-xml', children: ['x'] }] }
    ])
  })

  it('should_refuse_any_other_markup_when_the_output_is_unexpected', () => {
    expect(parseHighlight('<script>alert(1)</script>')).toBeNull()
    expect(parseHighlight('<span class="hljs-x" onclick="y">a</span>')).toBeNull()
    expect(parseHighlight('<img src=x onerror=alert(1)>')).toBeNull()
    expect(parseHighlight('<span class="hljs-x">non fermé')).toBeNull()
    expect(parseHighlight('</span>')).toBeNull()
    expect(parseHighlight('&nbsp;')).toBeNull()
  })

  it('should_split_a_colored_tree_into_lines_keeping_multi_line_segments_colored', () => {
    const tree = highlight('/* a\n b */\nconst x = 1', 'typescript')
    expect(tree).not.toBeNull()
    const lines = splitHighlightLines(tree ?? [])
    expect(lines).toHaveLength(3)
    expect(lines[0]).toEqual([{ className: 'hljs-comment', children: ['/* a'] }])
    expect(lines[1]).toEqual([{ className: 'hljs-comment', children: [' b */'] }])
    expect(lines[2]?.[0]).toEqual({ className: 'hljs-keyword', children: ['const'] })
    expect(splitHighlightLines(['a\n\nb'])).toEqual([['a'], [], ['b']])
  })

  it('should_color_known_languages_and_keep_hostile_source_as_text', () => {
    const tree = highlight('const x = "<img src=x onerror=alert(1)>"', 'typescript')
    expect(tree).not.toBeNull()
    expect(JSON.stringify(tree)).toContain('<img src=x onerror=alert(1)>')
    expect(highlight('texte', null)).toBeNull()
    expect(highlight('texte', 'cobol')).toBeNull()
  })
})
