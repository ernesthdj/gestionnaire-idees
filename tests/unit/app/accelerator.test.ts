import { describe, expect, it } from 'vitest'
import { isValidAccelerator } from '../../../src/shared/app/accelerator'

describe('raccourci global', () => {
  it.each(['Control+Alt+Space', 'CommandOrControl+Shift+I', 'Alt+F12', 'Ctrl+Shift+/', 'Super+Enter'])(
    'should_accept_%s_when_it_has_a_modifier_and_a_key',
    (accelerator) => {
      expect(isValidAccelerator(accelerator)).toBe(true)
    }
  )

  it.each([
    ['', 'vide'],
    ['Space', 'sans modificateur'],
    ['Control+Alt', 'sans touche'],
    ['Control+Control+A', 'modificateur répété'],
    ['Control+Foo', 'touche inconnue'],
    ['Hyper+A', 'modificateur inconnu'],
    ['Control+a', 'lettre minuscule'],
    ['Control+F25', 'touche de fonction inexistante']
  ])('should_reject_%s_when_%s', (accelerator) => {
    expect(isValidAccelerator(accelerator)).toBe(false)
  })
})
