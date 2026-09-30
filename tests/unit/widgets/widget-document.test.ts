import { describe, expect, it } from 'vitest'
import { buildWidgetDocument, themeFromQuery, WIDGET_CSP } from '../../../src/main/application/widgets/WidgetDocument'
import { transpileWidget } from '../../../src/main/application/widgets/transpile'
import { parseWidgetUrl } from '../../../src/main/application/widgets/widgetUrl'

const parts = {
  title: 'Compte à rebours',
  html: '<main id="app"></main>',
  css: 'main { color: red; }',
  js: 'console.info(1)'
}
const light = { scheme: 'light' as const, colors: {} }
const BLOCK = '00000000-0000-4000-8000-0000000000c2'
const VERSION = '00000000-0000-4000-8000-0000000000d1'

describe('document isolé d’un widget (spec 004 FR-007)', () => {
  it('should_forbid_every_connection_frame_and_form_in_the_content_security_policy', () => {
    expect(WIDGET_CSP).toContain("default-src 'none'")
    expect(WIDGET_CSP).not.toMatch(/connect-src|frame-src|child-src|http|\*/)
    expect(WIDGET_CSP).toContain("form-action 'none'")
    expect(WIDGET_CSP).toContain("base-uri 'none'")
  })

  it('should_put_the_policy_in_a_meta_tag_before_any_widget_code', () => {
    const document = buildWidgetDocument(parts, light)
    const meta = document.indexOf('http-equiv="Content-Security-Policy"')
    expect(meta).toBeGreaterThan(-1)
    expect(meta).toBeLessThan(document.indexOf('main { color: red; }'))
    expect(meta).toBeLessThan(document.indexOf('console.info(1)'))
  })

  it('should_neutralize_webrtc_before_the_widget_script_runs', () => {
    const document = buildWidgetDocument(parts, light)
    expect(document.indexOf('RTCPeerConnection')).toBeLessThan(document.indexOf('console.info(1)'))
  })

  it('should_keep_the_widget_code_inside_its_own_blocks_when_it_tries_to_close_them', () => {
    const document = buildWidgetDocument(
      { ...parts, css: 'a{}</style><script>evil()</script>', js: 'const s = "</script><img>"' },
      light
    )
    expect(document).not.toContain('</style><script>evil()')
    expect(document).toContain('<\\/style><script>evil()')
    expect(document).toContain('"<\\/script><img>"')
  })

  it('should_inject_only_hexadecimal_theme_colors_from_the_frame_address', () => {
    const theme = themeFromQuery(
      new URLSearchParams({ scheme: 'dark', surface: '#101010', accent: 'red;} body{background:url(https://x)' })
    )
    expect(theme).toEqual({ scheme: 'dark', colors: { surface: '#101010' } })
    const document = buildWidgetDocument(parts, theme)
    expect(document).toContain('--color-surface: #101010;')
    expect(document).toContain('--color-accent: #60a5fa;')
    expect(document).not.toContain('https://x')
    expect(document).toContain('data-theme="dark"')
  })

  it('should_strip_markup_from_the_title', () => {
    expect(buildWidgetDocument({ ...parts, title: '</title><script>x()</script>' }, light)).toContain(
      '<title>/titlescriptx()/script</title>'
    )
  })
})

describe('transpilation du TypeScript d’un widget (FR-006)', () => {
  it('should_remove_the_types_and_keep_the_code', () => {
    const result = transpileWidget('const total: number = 2 * 3\ninterface A { x: string }\nconsole.info(total)')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).not.toMatch(/: number|interface/)
    expect(result.value).toContain('console.info(total)')
  })

  it('should_also_convert_an_enum_instead_of_failing', () => {
    const result = transpileWidget('enum Mode { A, B }\nconsole.info(Mode.B)')
    expect(result.ok).toBe(true)
  })

  it('should_explain_why_invalid_code_cannot_be_used', () => {
    const result = transpileWidget('const = ;')
    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.error).toMatch(/^Le code TypeScript du widget est invalide/)
  })
})

describe('adresse d’un document de widget', () => {
  it('should_accept_only_a_widget_block_and_version', () => {
    expect(parseWidgetUrl(`gi-widget://widget/${BLOCK}/${VERSION}?scheme=dark`)).toEqual({
      blockId: BLOCK,
      versionId: VERSION
    })
  })

  it.each([
    `https://widget/${BLOCK}/${VERSION}`,
    `gi-widget://other/${BLOCK}/${VERSION}`,
    `gi-widget://widget/${BLOCK}`,
    `gi-widget://widget/${BLOCK}/${VERSION}/extra`,
    `gi-widget://widget/../${VERSION}`,
    'pas une adresse'
  ])('should_refuse_%s', (url) => {
    expect(parseWidgetUrl(url)).toBeNull()
  })
})
