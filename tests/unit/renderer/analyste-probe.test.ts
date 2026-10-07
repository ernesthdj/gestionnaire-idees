import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RendererProbeEvent } from '../../../src/shared/analyste/events'
import {
  enableProbe,
  flushProbe,
  framesOf,
  listenToErrors,
  probeAction,
  probeScreen,
  resetProbeForTests
} from '../../../src/renderer/src/analyste/probe'

describe('sonde de l’interface', () => {
  let sent: RendererProbeEvent[][]
  beforeEach(() => {
    sent = []
    resetProbeForTests(async (events) => {
      sent.push([...events])
    })
  })
  afterEach(() => enableProbe(false))

  it('should_send_nothing_when_the_probe_is_disabled', () => {
    probeAction('neuron.create', 'neuron', 'souris', 'n1')
    flushProbe()
    expect(sent).toEqual([])
  })

  it('should_batch_actions_and_screens_when_enabled', () => {
    enableProbe(true)
    probeAction('chat.send', 'conversation', 'clavier', 'n1')
    probeScreen('chat', true, 1_000)
    probeScreen('chat', false, 4_500)
    flushProbe()
    expect(sent).toEqual([
      [
        { event: 'chat.send', subjectKind: 'conversation', via: 'clavier', subjectId: 'n1' },
        { event: 'screen.open', screen: 'chat' },
        { event: 'panel.close', screen: 'chat', durationMs: 3_500 }
      ]
    ])
  })

  it('should_keep_only_repository_frames_and_never_the_message_when_an_error_escapes', () => {
    enableProbe(true)
    const stop = listenToErrors()
    const error = new TypeError('Cannot read properties of « Acheter du pain »')
    error.stack = [
      'TypeError: Cannot read properties of « Acheter du pain »',
      '    at buildGraph (http://localhost:5173/src/canvas/buildGraph.ts?t=17:212:9)',
      '    at http://localhost:5173/node_modules/.vite/deps/react.js:10:3',
      '    at render (http://localhost:5173/src/canvas/IdeasCanvas.tsx:40:1)'
    ].join('\n')
    window.dispatchEvent(new ErrorEvent('error', { error }))
    stop()
    flushProbe()
    expect(sent[0]).toEqual([
      {
        event: 'error.renderer',
        code: 'TypeError',
        frames: ['src/renderer/src/canvas/buildGraph.ts:212', 'src/renderer/src/canvas/IdeasCanvas.tsx:40']
      }
    ])
    expect(JSON.stringify(sent)).not.toContain('pain')
  })

  it('should_ignore_frames_outside_the_source_when_parsing_a_stack', () => {
    expect(framesOf('at x (file:///C:/Users/x/app.js:1:1)')).toEqual([])
    expect(framesOf(undefined)).toEqual([])
  })

  it('should_flush_on_a_timer_when_enabled', () => {
    vi.useFakeTimers()
    try {
      enableProbe(true)
      probeAction('link.create', 'link', 'souris')
      vi.advanceTimersByTime(2_000)
      expect(sent).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('should_locate_an_error_event_without_error_object_and_name_a_non_error_rejection', () => {
    enableProbe(true)
    const stop = listenToErrors()
    window.dispatchEvent(
      new ErrorEvent('error', {
        error: null,
        message: 'ResizeObserver loop « Acheter du pain »',
        filename: 'http://localhost:5173/src/canvas/IdeasCanvas.tsx?t=1',
        lineno: 42
      })
    )
    const rejection = new Event('unhandledrejection') as Event & { reason: unknown }
    rejection.reason = { texte: 'Acheter du pain' }
    window.dispatchEvent(rejection)
    const stringRejection = new Event('unhandledrejection') as Event & { reason: unknown }
    stringRejection.reason = 'Acheter du pain'
    window.dispatchEvent(stringRejection)
    stop()
    flushProbe()
    expect(sent[0]).toEqual([
      { event: 'error.renderer', code: 'ErrorEvent', frames: ['src/renderer/src/canvas/IdeasCanvas.tsx:42'] },
      { event: 'error.renderer', code: 'NonError.Object', frames: [] },
      { event: 'error.renderer', code: 'NonError.string', frames: [] }
    ])
    expect(JSON.stringify(sent)).not.toContain('pain')
  })
})
