import { describe, expect, it } from 'vitest'
import { buildResultDocument } from '../../../src/main/application/widgets/GenericResultView'
import { GENERIC_RESULT_JS } from '../../../src/shared/widgets/genericResultView'
import { buildWidgetDocument, WIDGET_CSP } from '../../../src/main/application/widgets/WidgetDocument'
import { parseResultUrl, parseWidgetUrl } from '../../../src/main/application/widgets/widgetUrl'
import { WIDGET_FRAME } from '../../../src/main/infrastructure/ai/WidgetFrame'

const light = { scheme: 'light' as const, colors: {} }
const BLOCK = '00000000-0000-4000-8000-0000000000c3'

describe('pont de sortie dans le document isolé (spec 005 FR-004)', () => {
  const document = buildWidgetDocument(
    { title: 'Budget', html: '<main></main>', css: '', js: 'gi.output({ total: 1 })' },
    light
  )

  it('should_offer_output_on_the_frozen_bridge_and_send_only_json_to_the_application', () => {
    expect(document).toContain('output(data) {')
    expect(document).toContain('JSON.parse(JSON.stringify(data))')
    expect(document).toContain("window.parent.postMessage({ type: 'gi:output', data: plain }, '*')")
    expect(document.indexOf('output(data) {')).toBeLessThan(document.indexOf('gi.output({ total: 1 })'))
  })

  it('should_show_a_refusal_only_when_it_comes_from_the_application_window', () => {
    const guard = document.indexOf('if (event.source !== window.parent) return')
    const refusal = document.indexOf("data.type === 'gi:refused'")
    expect(guard).toBeGreaterThan(-1)
    expect(refusal).toBeGreaterThan(guard)
  })

  it('should_tell_claude_how_a_widget_publishes_a_result', () => {
    expect(WIDGET_FRAME).toContain('window.gi.output(données)')
    expect(WIDGET_FRAME).toContain('200 Ko')
  })
})

describe('document d’un cadre résultat (spec 005 FR-006)', () => {
  const document = buildResultDocument(light)

  it('should_be_as_isolated_as_a_widget_and_run_only_the_generic_view', () => {
    expect(document).toContain(`<meta http-equiv="Content-Security-Policy" content="${WIDGET_CSP}">`)
    expect(document).toContain('<main id="gi-result" aria-live="polite"></main>')
    expect(document).toContain('gi.onInputs((inputs) => {')
  })

  it('should_write_every_value_as_text_and_never_as_markup', () => {
    expect(GENERIC_RESULT_JS).toContain('node.textContent = text')
    expect(GENERIC_RESULT_JS).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|Function\(/)
    // La vue ne publie rien : un cadre résultat n'a qu'une capacité, lire le résultat de son widget.
    expect(GENERIC_RESULT_JS).not.toContain('gi.output')
  })
})

describe('adresse du document d’un cadre résultat', () => {
  it('should_accept_only_a_result_block', () => {
    expect(parseResultUrl(`gi-widget://result/${BLOCK}?scheme=dark`)).toEqual({ blockId: BLOCK })
    expect(parseWidgetUrl(`gi-widget://result/${BLOCK}`)).toBeNull()
  })

  it.each([
    `https://result/${BLOCK}`,
    `gi-widget://widget/${BLOCK}`,
    `gi-widget://result/${BLOCK}/extra`,
    'gi-widget://result/pas-un-uuid',
    'gi-widget://result/',
    'pas une adresse'
  ])('should_refuse_%s', (url) => {
    expect(parseResultUrl(url)).toBeNull()
  })
})
