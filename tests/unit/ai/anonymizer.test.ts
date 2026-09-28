import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { Anonymizer } from '../../../src/main/application/ai/Anonymizer'

const Cases = z.array(z.object({ text: z.string(), persons: z.array(z.string()), mustNotContain: z.array(z.string()) }))
const cases = Cases.parse(
  JSON.parse(readFileSync(resolve(import.meta.dirname, '../../fixtures/anonymizer/cases.json'), 'utf8'))
)

describe('Anonymizer', () => {
  it('should_leak_nothing_on_50_fictive_texts_when_local_ai_detects_names', async () => {
    for (const testCase of cases) {
      const anonymizer = new Anonymizer({ detectSensitive: async () => ({ persons: testCase.persons, places: [] }) })
      const out = await anonymizer.anonymize(testCase.text)
      for (const secret of testCase.mustNotContain) expect(out, testCase.text).not.toContain(secret)
    }
  })

  it('should_leak_nothing_on_50_fictive_texts_when_local_ai_is_down', async () => {
    const anonymizer = new Anonymizer({ detectSensitive: async () => null })
    for (const testCase of cases) {
      const out = await anonymizer.anonymize(testCase.text)
      for (const secret of testCase.mustNotContain) expect(out, testCase.text).not.toContain(secret)
    }
  })

  it('should_fall_back_to_heuristic_when_detection_throws', async () => {
    const anonymizer = new Anonymizer({
      detectSensitive: async () => {
        throw new Error('ollama en panne')
      }
    })
    await expect(anonymizer.anonymize('Karim paiera 250 €')).resolves.toBe('[nom] paiera [montant 100-500 €]')
  })

  it('should_keep_exact_amounts_when_masking_is_off_but_still_hide_contacts', async () => {
    let masking = false
    const anonymizer = new Anonymizer({ detectSensitive: async () => null, maskAmounts: () => masking })
    const text = 'budget 1 249,50 € — écrire à a.b@example.com'
    await expect(anonymizer.anonymize(text)).resolves.toBe('budget 1 249,50 € — écrire à [e-mail]')
    masking = true // le réglage est relu à chaque appel
    await expect(anonymizer.anonymize(text)).resolves.toBe('budget [montant 1000-2500 €] — écrire à [e-mail]')
  })

  it('should_apply_rules_before_asking_local_ai_so_it_never_sees_contacts', async () => {
    const seen: string[] = []
    const anonymizer = new Anonymizer({
      detectSensitive: async (text) => {
        seen.push(text)
        return { persons: [], places: [] }
      }
    })
    await anonymizer.anonymize('Écrire à marc@exemple.test pour 1 200 €')
    expect(seen[0]).not.toMatch(/marc@|1 200/)
  })

  it('should_ignore_detected_names_that_are_not_in_the_text', async () => {
    const anonymizer = new Anonymizer({
      detectSensitive: async () => ({ persons: ['Inventé'], places: ['Nullepart'] })
    })
    await expect(anonymizer.anonymize('acheter une télé')).resolves.toBe('acheter une télé')
  })

  it('should_mask_places_detected_by_local_ai', async () => {
    const anonymizer = new Anonymizer({
      detectSensitive: async () => ({ persons: ['Léa'], places: ['Namur', 'Citadelle'] })
    })
    await expect(anonymizer.anonymize('Shooting avec Léa à la Citadelle de Namur')).resolves.toBe(
      'Shooting avec [personne] à la [lieu] de [lieu]'
    )
  })

  it('should_mask_postal_address_even_when_local_ai_misses_it', async () => {
    const anonymizer = new Anonymizer({ detectSensitive: async () => ({ persons: [], places: [] }) })
    await expect(anonymizer.anonymize('Livrer au 12 rue de la Loi, 1000 Bruxelles')).resolves.toBe(
      'Livrer au [adresse], [lieu]'
    )
  })
})
