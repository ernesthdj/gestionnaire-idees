import { describe, expect, it } from 'vitest'
import { coveredElements, manualProgress } from '../../../src/main/domain/structure/status'

describe('avancement au changement de statut à la main (spec 030 D3)', () => {
  it('should_set_100_percent_and_clear_the_rest_when_delivered', () => {
    expect(manualProgress({ status: 'en_cours', progress: 60, note: 'tests' }, 'livree')).toEqual({
      status: 'livree',
      progress: 100,
      note: null
    })
  })

  it('should_clear_a_100_percent_when_a_delivered_element_is_reopened', () => {
    expect(manualProgress({ status: 'livree', progress: 100, note: null }, 'en_cours')).toEqual({
      status: 'en_cours',
      progress: null,
      note: null
    })
  })

  it('should_keep_a_partial_progress_when_blocked_and_clear_it_when_back_to_todo', () => {
    const current = { status: 'en_cours', progress: 40, note: 'API' } as const
    expect(manualProgress(current, 'bloquee')).toEqual({ status: 'bloquee', progress: 40, note: 'API' })
    expect(manualProgress(current, 'a_faire')).toEqual({ status: 'a_faire', progress: null, note: 'API' })
  })
})

describe('éléments couverts par un commit (spec 030 D5, D6)', () => {
  const element = (id: string, parentId: string, paths: string[], status: 'livree' | 'en_cours' | null = null) => ({
    id,
    parentId,
    status,
    paths
  })

  it('should_cover_a_leaf_by_its_file_or_one_of_its_folders', () => {
    const elements = [
      element('api', 'g', ['server/src/']),
      element('depot', 'api', ['server/src/routes/depots.ts']),
      element('suivi', 'api', ['./server/src/routes/suivi/**']),
      element('pwa', 'g', ['web\\src\\Comptoir.tsx'])
    ]
    const covered = coveredElements(elements, ['server/src/routes/depots.ts', 'server/src/routes/suivi/page.ts'])
    expect(covered.map((entry) => entry.id)).toEqual(['depot', 'suivi'])
    expect(coveredElements(elements, ['web/src/Comptoir.tsx']).map((entry) => entry.id)).toEqual(['pwa'])
  })

  it('should_never_cover_a_parent_a_delivered_element_or_an_element_without_paths', () => {
    const elements = [
      element('module', 'g', ['src']),
      element('fait', 'module', ['src/a.ts'], 'livree'),
      element('vide', 'module', []),
      element('voisin', 'g', ['src/ab.ts'])
    ]
    expect(coveredElements(elements, ['src/a.ts', 'src/abc.ts'])).toEqual([])
  })
})
