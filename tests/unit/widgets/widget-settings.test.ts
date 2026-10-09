import { describe, expect, it } from 'vitest'
import { SettingsDeclaration, settingValues, type SettingField } from '../../../src/shared/widgets/settings'

const fields = (raw: unknown): SettingField[] => SettingsDeclaration.parse(raw)

describe('réglages déclarés par un widget (spec 026 D7)', () => {
  const declared = fields([
    { key: 'titre', label: 'Titre', type: 'text', default: 'Accueil' },
    { key: 'etat', label: 'État', type: 'select', options: ['Normal', 'Erreur'], group: 'Écran' },
    { key: 'mobile', label: 'Mobile', type: 'toggle' },
    { key: 'accent', label: 'Accent', type: 'color', default: '#2563EB' },
    { key: 'taille', label: 'Taille', type: 'range', min: 12, max: 20, default: 14 }
  ])

  it('should_fill_every_setting_with_its_default_when_nothing_is_chosen', () => {
    expect(settingValues(declared, undefined)).toEqual({
      titre: 'Accueil',
      etat: 'Normal',
      mobile: false,
      accent: '#2563EB',
      taille: 14
    })
  })

  it('should_bring_each_value_back_to_its_declaration', () => {
    const values = settingValues(declared, {
      titre: 42,
      etat: 'Inconnu',
      mobile: 'oui',
      accent: 'red',
      taille: 99,
      intrus: 'x'
    })
    expect(values).toEqual({ titre: 'Accueil', etat: 'Normal', mobile: false, accent: '#2563EB', taille: 20 })
    expect(settingValues(declared, { etat: 'Erreur', accent: '#FF0000', taille: 16 })).toMatchObject({
      etat: 'Erreur',
      accent: '#ff0000',
      taille: 16
    })
  })

  it('should_refuse_a_duplicate_key_an_unknown_type_and_an_invalid_range', () => {
    const text = { key: 'a', label: 'A', type: 'text' }
    expect(SettingsDeclaration.safeParse([text, text]).success).toBe(false)
    expect(SettingsDeclaration.safeParse([{ key: 'a', label: 'A', type: 'script' }]).success).toBe(false)
    expect(SettingsDeclaration.safeParse([{ key: 'a', label: 'A', type: 'range', min: 5, max: 5 }]).success).toBe(false)
    expect(SettingsDeclaration.safeParse([{ key: '__proto__', label: 'A', type: 'text' }]).success).toBe(false)
    expect(SettingsDeclaration.safeParse([]).success).toBe(false)
    expect(
      SettingsDeclaration.safeParse(Array.from({ length: 41 }, (_, i) => ({ ...text, key: `k${i}` }))).success
    ).toBe(false)
  })
})
