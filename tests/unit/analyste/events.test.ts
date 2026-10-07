import { describe, expect, it } from 'vitest'
import { familyOf, RendererProbeEvent } from '../../../src/shared/analyste/events'

const accepts = (value: unknown): boolean => RendererProbeEvent.safeParse(value).success

describe('catalogue fermé des événements de la sonde', () => {
  it('should_accept_catalogued_events_when_their_fields_are_valid', () => {
    expect(accepts({ event: 'screen.open', screen: 'carte' })).toBe(true)
    expect(accepts({ event: 'panel.close', screen: 'chat', durationMs: 4200 })).toBe(true)
    expect(accepts({ event: 'neuron.create', subjectKind: 'neuron', subjectId: 'n-1', via: 'clavier' })).toBe(true)
    expect(
      accepts({ event: 'error.renderer', code: 'TypeError', frames: ['src/renderer/src/canvas/buildGraph.ts:212'] })
    ).toBe(true)
  })

  it('should_reject_an_event_when_it_is_not_in_the_catalogue', () => {
    expect(accepts({ event: 'idea.text', text: 'Acheter du pain' })).toBe(false)
  })

  it('should_reject_an_event_when_it_carries_an_extra_field', () => {
    expect(accepts({ event: 'neuron.create', subjectKind: 'neuron', via: 'souris', title: 'Acheter du pain' })).toBe(
      false
    )
    expect(accepts({ event: 'error.renderer', code: 'TypeError', frames: [], message: 'texte saisi' })).toBe(false)
  })

  it('should_reject_free_text_when_a_code_or_a_screen_is_expected', () => {
    expect(accepts({ event: 'error.renderer', code: 'Cannot read property of acheter du pain', frames: [] })).toBe(
      false
    )
    expect(accepts({ event: 'screen.open', screen: 'ma liste de courses' })).toBe(false)
    expect(accepts({ event: 'neuron.create', subjectKind: 'neuron', subjectId: 'x'.repeat(65), via: 'souris' })).toBe(
      false
    )
  })

  it('should_reject_a_frame_when_it_is_absolute_or_climbs_out_of_the_repository', () => {
    const frames = (frame: string) => accepts({ event: 'error.renderer', code: 'TypeError', frames: [frame] })
    expect(frames('C:/Users/x/secret.ts:1')).toBe(false)
    expect(frames('/home/x/a.ts:1')).toBe(false)
    expect(frames('src/../../a.ts:1')).toBe(false)
    expect(frames('src/a.ts')).toBe(false)
    expect(accepts({ event: 'error.renderer', code: 'E', frames: Array(6).fill('src/a.ts:1') })).toBe(false)
  })

  it('should_classify_each_event_in_its_family_when_asked', () => {
    expect(familyOf('screen.open')).toBe('navigation')
    expect(familyOf('error.renderer')).toBe('erreur')
    expect(familyOf('chat.send')).toBe('action')
  })
})
