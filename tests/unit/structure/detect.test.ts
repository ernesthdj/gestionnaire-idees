import { describe, expect, it } from 'vitest'
import { detectArchitecture } from '../../../src/shared/structure/detect'

const detect = (paths: string[], calls: [string, string][] = []) =>
  detectArchitecture({ paths, calls: calls.map(([from, to]) => ({ from, to })) })

describe('detectArchitecture (spec 032 D15)', () => {
  it('should_recognise_clean_when_two_of_domain_application_infrastructure_are_folders', () => {
    const result = detect(
      ['src/domain/Order.ts', 'src/application/PlaceOrder.ts', 'src/infrastructure/Db.ts'],
      [['src/application/PlaceOrder.ts', 'src/domain/Order.ts']]
    )
    expect(result).toEqual({
      kind: 'clean',
      reason: 'Dossiers « domain », « application » et « infrastructure » ; les appels vont vers le cœur.',
      violations: 0
    })
  })

  it('should_count_the_calls_that_leave_the_core_when_the_domain_calls_outward', () => {
    const result = detect(
      ['src/domain/Order.ts', 'src/infrastructure/Db.ts'],
      [
        ['src/domain/Order.ts', 'src/infrastructure/Db.ts'],
        ['src/infrastructure/Db.ts', 'src/domain/Order.ts']
      ]
    )
    expect(result.violations).toBe(1)
    expect(result.reason).toBe('Dossiers « domain » et « infrastructure » ; 1 appel sort du cœur vers l’extérieur.')
  })

  it('should_prefer_hexagonal_and_mvvm_signatures_over_a_domain_folder', () => {
    expect(detect(['src/domain/a.ts', 'src/ports/b.ts', 'src/adapters/c.ts']).kind).toBe('hexagonale')
    expect(detect(['App/ViewModels/MainViewModel.cs', 'App/Models/Item.cs']).kind).toBe('mvvm')
  })

  it('should_recognise_mvc_from_controllers_and_models_whatever_their_case', () => {
    const result = detect(['app/Http/Controllers/A.php', 'app/Models/B.php'])
    expect(result).toMatchObject({
      kind: 'mvc',
      reason: 'Dossiers « Controllers » et « Models » ; aucun appel entre couches.'
    })
  })

  it('should_recognise_layers_and_ignore_file_names', () => {
    expect(detect(['ui/page.ts', 'services/a.ts', 'data/db.ts']).kind).toBe('couches')
    // Un fichier nommé `domain.ts` n'est pas un dossier.
    expect(detect(['src/domain.ts', 'src/infra.ts'])).toEqual({
      kind: 'aucune',
      reason: 'Aucun dossier ne nomme de couche connue (domaine, contrôleurs, ports…).',
      violations: 0
    })
  })

  it('should_not_recognise_clean_from_a_single_layer_folder', () => {
    expect(detect(['src/core/a.ts', 'src/utils/b.ts']).kind).toBe('aucune')
  })
})
