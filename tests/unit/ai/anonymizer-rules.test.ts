import { describe, expect, it } from 'vitest'
import {
  amountBand,
  applyDeterministicRules,
  maskCapitalizedWords,
  parseAmount,
  replacePersons,
  replacePlaces
} from '../../../src/main/domain/ai/anonymizationRules'

describe('parseAmount', () => {
  it.each([
    ['1 247,50', 1247.5],
    ['1.250', 1250],
    ['1250.50', 1250.5],
    ['80', 80],
    ['3 200', 3200],
    ['2k', 2000]
  ])('should_parse_%s_as_%d_when_reading_french_amounts', (raw, expected) => {
    expect(parseAmount(raw)).toBeCloseTo(expected)
  })
})

describe('amountBand', () => {
  it.each([
    [45, '<100 €'],
    [250, '100-500 €'],
    [640, '500-1000 €'],
    [1247.5, '1000-2500 €'],
    [3200, '>2500 €']
  ])('should_map_%d_to_band_when_hiding_exact_amount', (value, band) => {
    expect(amountBand(value)).toBe(band)
  })
})

describe('applyDeterministicRules', () => {
  it('should_replace_amounts_by_band_when_text_contains_prices', () => {
    const out = applyDeterministicRules('Payer 1 247,50 € puis 250€ et 80 EUR, aussi € 3200.')
    expect(out).toBe(
      'Payer [montant 1000-2500 €] puis [montant 100-500 €] et [montant <100 €], aussi [montant >2500 €].'
    )
  })

  it('should_remove_email_phone_iban_and_url_when_present', () => {
    const out = applyDeterministicRules(
      'Écrire à marc.d@exemple.test, appeler le +32 470 12 34 56 ou 06 12 34 56 78, IBAN BE68 5390 0754 7034, voir https://prive.test/x'
    )
    expect(out).not.toMatch(/exemple\.test|470|06 12|BE68|prive\.test/)
    expect(out).toContain('[e-mail]')
    expect(out).toContain('[téléphone]')
    expect(out).toContain('[IBAN]')
    expect(out).toContain('[lien]')
  })

  it('should_keep_ordinary_text_and_dates_when_nothing_is_sensitive', () => {
    expect(applyDeterministicRules('Acheter un écran 27 pouces le 15/11')).toBe('Acheter un écran 27 pouces le 15/11')
  })
})

describe('replacePersons', () => {
  it('should_replace_every_occurrence_of_each_detected_name', () => {
    expect(replacePersons('Sophie Lambert et Marc ; Marc paiera.', ['Sophie Lambert', 'Marc'])).toBe(
      '[personne] et [personne] ; [personne] paiera.'
    )
  })

  it('should_ignore_empty_or_very_short_names_when_replacing', () => {
    expect(replacePersons('Le PC de A', ['', 'A'])).toBe('Le PC de A')
  })
})

describe('maskCapitalizedWords (repli sans IA)', () => {
  it('should_mask_names_including_at_sentence_start_when_not_whitelisted', () => {
    expect(maskCapitalizedWords('Karim a appelé. Payer Julie Dubois demain.')).toBe(
      '[nom] a appelé. Payer [nom] [nom] demain.'
    )
  })

  it('should_keep_short_acronyms_and_common_starters_when_masking', () => {
    expect(maskCapitalizedWords('Acheter un PC et un NAS pour le projet IT')).toBe(
      'Acheter un PC et un NAS pour le projet IT'
    )
  })
})

describe('adresses postales (règle déterministe)', () => {
  it.each([
    ['Livrer au 12 rue de la Loi à 1000 Bruxelles', 'Livrer au [adresse] à [lieu]'],
    ['RDV 5bis avenue Louise, 1050 Ixelles', 'RDV [adresse], [lieu]'],
    ['Studio au 48 boulevard Voltaire 75011 Paris', 'Studio au [adresse] [lieu]'],
    ['Passer chaussée de Waterloo 250', 'Passer [adresse]']
  ])('should_mask_street_address_and_postcode_when_present: %s', (input, expected) => {
    expect(applyDeterministicRules(input)).toBe(expected)
  })

  it('should_keep_numbers_that_are_not_addresses', () => {
    expect(applyDeterministicRules('Écran 27 pouces, 2 exemplaires')).toBe('Écran 27 pouces, 2 exemplaires')
  })
})

describe('replacePlaces', () => {
  it('should_replace_detected_places_by_placeholder', () => {
    expect(replacePlaces('Shooting à Namur puis resto au Cercle de Wallonie', ['Namur', 'Cercle de Wallonie'])).toBe(
      'Shooting à [lieu] puis resto au [lieu]'
    )
  })
})
