import { describe, expect, it } from 'vitest'
import {
  GENERIC_RESULT_HTML,
  GENERIC_RESULT_JS,
  GENERIC_VIEW_MAX_ROWS
} from '../../../src/shared/widgets/genericResultView'

type Listener = (inputs: readonly unknown[]) => void

/** Exécute le code figé de la vue générique comme dans son cadre : un document, et le pont `gi`. */
function mount(): { readonly root: HTMLElement; readonly give: Listener } {
  document.body.innerHTML = GENERIC_RESULT_HTML
  const listeners: Listener[] = []
  const gi = { onInputs: (listener: Listener) => listeners.push(listener) }
  // Le code de la vue est une chaîne (il ne s'exécute jamais dans l'application) : on l'évalue ici comme le cadre.
  new Function('gi', GENERIC_RESULT_JS)(gi)
  const root = document.getElementById('gi-result')
  if (root === null) throw new Error('racine attendue')
  return { root, give: (inputs) => listeners.forEach((listener) => listener(inputs)) }
}

function show(data: unknown): HTMLElement {
  const { root, give } = mount()
  give([{ kind: 'result', data }])
  return root
}

describe('vue générique d’un résultat (spec 005 FR-007)', () => {
  it('should_wait_for_the_result_until_it_is_given', () => {
    const { root, give } = mount()
    expect(root.textContent).toBe('En attente du résultat…')
    give([])
    expect(root.textContent).toBe('En attente du résultat…')
  })

  it.each([
    [1250, '1250'],
    ['Traiteur', 'Traiteur'],
    [true, 'oui'],
    [false, 'non'],
    [null, '—']
  ])('should_show_the_simple_value_%s', (value, text) => {
    const root = show(value)
    expect(root.querySelector('.gi-value')?.textContent).toBe(text)
  })

  it('should_show_a_list_of_simple_values_as_a_list', () => {
    const root = show(['Traiteur', 'DJ', 12])
    expect([...root.querySelectorAll('ol > li')].map((item) => item.textContent)).toEqual(['Traiteur', 'DJ', '12'])
    expect(root.querySelector('table')).toBeNull()
  })

  it('should_show_a_list_of_objects_as_a_table_with_every_field_as_a_column', () => {
    const root = show([
      { libelle: 'Traiteur', montant: 900 },
      { libelle: 'DJ', montant: 350, paye: true }
    ])
    expect([...root.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual(['libelle', 'montant', 'paye'])
    expect(
      [...root.querySelectorAll('tbody tr')].map((row) => [...row.children].map((cell) => cell.textContent))
    ).toEqual([
      ['Traiteur', '900', ''],
      ['DJ', '350', 'oui']
    ])
    // Une colonne de nombres est alignée à droite.
    expect(root.querySelectorAll('td.gi-number')).toHaveLength(2)
  })

  it('should_show_an_object_as_a_tree_and_nest_what_it_contains', () => {
    const root = show({ total: 1250, lignes: [{ libelle: 'Traiteur', montant: 900 }], lieu: { ville: 'Mons' } })
    const terms = [...root.querySelectorAll(':scope > dl > dt')].map((term) => term.textContent)
    expect(terms).toEqual(['total', 'lignes', 'lieu'])
    expect(root.querySelector('dd table tbody tr')?.textContent).toBe('Traiteur900')
    expect(root.querySelector('dd > dl > dt')?.textContent).toBe('ville')
  })

  it('should_say_when_there_is_nothing_to_show', () => {
    expect(show([]).textContent).toBe('Liste vide')
    expect(show({}).textContent).toBe('Aucune donnée')
  })

  it('should_show_html_and_script_as_text_and_never_interpret_them', () => {
    const attack = '<img src=x onerror="window.pwned = true"><script>window.pwned = true</script>'
    const root = show({ [attack]: attack, lignes: [{ note: attack }], liste: [attack] })
    expect(root.querySelector('img, script')).toBeNull()
    expect(root.querySelector('dt')?.textContent).toBe(attack)
    expect(root.querySelector('td')?.textContent).toBe(attack)
    expect(root.querySelector('li')?.textContent).toBe(attack)
    expect((window as unknown as { pwned?: boolean }).pwned).toBeUndefined()
  })

  it('should_show_a_thousand_rows_quickly_and_count_the_ones_it_leaves_out', () => {
    const rows = (count: number): unknown[] =>
      Array.from({ length: count }, (_, index) => ({ n: index, nom: `Ligne ${index}` }))
    const start = performance.now()
    const root = show(rows(GENERIC_VIEW_MAX_ROWS))
    expect(performance.now() - start).toBeLessThan(2000)
    expect(root.querySelectorAll('tbody tr')).toHaveLength(GENERIC_VIEW_MAX_ROWS)
    expect(root.textContent).not.toContain('de plus')

    const more = show(rows(GENERIC_VIEW_MAX_ROWS + 250))
    expect(more.querySelectorAll('tbody tr')).toHaveLength(GENERIC_VIEW_MAX_ROWS)
    expect(more.textContent).toContain('… et 250 lignes de plus')
  })

  it('should_replace_the_previous_result_when_a_new_one_arrives', () => {
    const { root, give } = mount()
    give([{ kind: 'result', data: { total: 1 } }])
    give([{ kind: 'result', data: { total: 2 } }])
    expect(root.querySelectorAll('dl')).toHaveLength(1)
    expect(root.querySelector('dd')?.textContent).toBe('2')
  })
})
