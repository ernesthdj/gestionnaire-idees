import { describe, expect, it } from 'vitest'
import {
  ARCHITECTURE_KINDS,
  ARCHITECTURES,
  inferLayer,
  isViolation,
  layerOf
} from '../../../src/shared/structure/architecture'

describe('architectures d’une carte de structure (spec 017 D20)', () => {
  it('should_define_unique_layers_ordered_from_outside_to_core_for_every_architecture', () => {
    for (const kind of ARCHITECTURE_KINDS) {
      const { layers } = ARCHITECTURES[kind]
      expect(new Set(layers.map((entry) => entry.id)).size).toBe(layers.length)
      const depths = layers.map((entry) => entry.depth)
      expect([...depths].sort((a, b) => a - b)).toEqual(depths)
    }
    expect(ARCHITECTURES.aucune.layers).toEqual([])
  })

  it('should_flag_a_link_from_the_core_to_an_outer_layer_as_a_violation', () => {
    expect(isViolation('clean', 'domaine', 'infrastructure')).toBe(true)
    expect(isViolation('clean', 'application', 'presentation')).toBe(true)
    expect(isViolation('mvvm', 'modele', 'vue')).toBe(true)
    expect(isViolation('couches', 'donnees', 'metier')).toBe(true)
  })

  it('should_accept_links_toward_the_core_or_inside_the_same_ring', () => {
    expect(isViolation('clean', 'infrastructure', 'domaine')).toBe(false)
    expect(isViolation('clean', 'presentation', 'application')).toBe(false)
    expect(isViolation('clean', 'presentation', 'infrastructure')).toBe(false)
    expect(isViolation('mvc', 'controleur', 'vue')).toBe(false)
  })

  it('should_never_flag_when_a_layer_is_unknown_or_missing', () => {
    expect(isViolation('clean', null, 'presentation')).toBe(false)
    expect(isViolation('clean', 'domaine', 'inconnue')).toBe(false)
    expect(isViolation('aucune', 'domaine', 'presentation')).toBe(false)
    expect(layerOf('mvvm', 'domaine')).toBeNull()
  })

  it('should_infer_the_layer_from_the_deepest_named_folder_when_claude_gave_none', () => {
    expect(inferLayer('clean', ['src/main/domain/structure'])).toBe('domaine')
    expect(inferLayer('clean', ['src/main/infrastructure/db', 'src/main/infrastructure/ai'])).toBe('infrastructure')
    expect(inferLayer('clean', ['src/renderer/src/canvas'])).toBe('presentation')
    expect(inferLayer('mvvm', ['App/ViewModels/MainViewModel.cs'])).toBe('viewmodel')
    expect(inferLayer('mvc', ['app/Http/Controllers/InvoiceController.php'])).toBe('controleur')
  })

  it('should_infer_nothing_when_folders_say_nothing_or_disagree_evenly', () => {
    expect(inferLayer('clean', ['scripts', 'README.md'])).toBeNull()
    expect(inferLayer('clean', ['src/domain', 'src/infrastructure'])).toBeNull()
    expect(inferLayer('aucune', ['src/domain'])).toBeNull()
  })
})
