import { describe, expect, it } from 'vitest'
import { callContext, calleeOf } from '../../../src/main/domain/reprise/callContext'

const body = Array.from({ length: 30 }, (_, index) => `ligne ${index + 1}`)

describe('contexte d’un appel ambigu (spec 017 US6, T032)', () => {
  it('should_center_at_most_eight_lines_on_the_first_line_that_names_the_callee', () => {
    const lines = [...body]
    lines[14] = '    store.Save(due);'
    const context = callContext(lines, 1, 30, 'Save')
    expect(context).toHaveLength(8)
    expect(context).toContain('    store.Save(due);')
    expect(context[3]).toBe('    store.Save(due);')
  })

  it('should_stay_inside_the_calling_element_and_never_return_more_than_the_limit', () => {
    const lines = [...body]
    lines[0] = 'Save() hors de l’élément'
    lines[9] = 'x.Save(1)'
    const context = callContext(lines, 8, 12, 'Save', 8)
    expect(context.every((line) => line !== 'Save() hors de l’élément')).toBe(true)
    expect(context.length).toBeLessThanOrEqual(5)
    expect(context).toContain('x.Save(1)')
    expect(callContext(lines, 1, 30, 'Save', 3)).toHaveLength(3)
  })

  it('should_fall_back_to_the_start_of_the_element_when_the_callee_is_not_found', () => {
    expect(callContext(body, 10, 30, 'Inconnu')).toEqual(body.slice(9, 17))
  })

  it('should_clamp_a_range_beyond_the_file_and_handle_an_empty_file', () => {
    expect(callContext(['a', 'b'], 1, 99, 'b')).toEqual(['a', 'b'])
    expect(callContext([], 1, 5, 'x')).toEqual([])
  })

  it('should_trim_trailing_whitespace', () => {
    expect(callContext(['  a();   ', 'b();\t'], 1, 2, 'a')).toEqual(['  a();', 'b();'])
  })

  it('should_extract_the_called_name_whatever_the_language_separator', () => {
    expect(calleeOf('store.Save')).toBe('Save')
    expect(calleeOf('Order::all')).toBe('all')
    expect(calleeOf('$this->repository->save')).toBe('save')
    expect(calleeOf('Save')).toBe('Save')
    expect(calleeOf('App\\Models\\Order')).toBe('Order')
  })
})
