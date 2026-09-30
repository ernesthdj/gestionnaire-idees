import { describe, expect, it } from 'vitest'
import { checkResult, RESULT_LIMITS } from '../../../src/main/domain/widgets/resultLimits'

const nested = (levels: number): unknown => (levels === 0 ? 1 : { n: nested(levels - 1) })

describe('bornes d’un résultat de widget (spec 005 FR-005)', () => {
  it('should_accept_plain_json_and_serialize_it', () => {
    const data = { total: 1250, lignes: [{ libelle: 'Traiteur', montant: 900, paye: false, note: null }] }
    expect(checkResult(data)).toEqual({ ok: true, json: JSON.stringify(data) })
    expect(checkResult('texte seul')).toMatchObject({ ok: true })
    expect(checkResult(0)).toMatchObject({ ok: true })
    expect(checkResult(null)).toMatchObject({ ok: true })
  })

  it.each([
    ['une fonction', { f: () => 1 }],
    ['une date', { d: new Date(0) }],
    ['une table de hachage', new Map([['a', 1]])],
    ['une valeur absente dans une liste', [undefined]],
    ['un nombre infini', { n: Number.POSITIVE_INFINITY }],
    ['NaN', [Number.NaN]],
    ['un grand entier', { n: 1n }]
  ])('should_refuse_%s_when_it_is_not_json', (_name, data) => {
    expect(checkResult(data)).toMatchObject({ ok: false, reason: expect.stringMatching(/^Résultat refusé/) })
  })

  it('should_refuse_missing_data', () => {
    expect(checkResult(undefined)).toEqual({ ok: false, reason: 'Résultat refusé : aucune donnée.' })
  })

  it('should_accept_the_maximum_depth_and_refuse_one_level_more', () => {
    expect(checkResult(nested(RESULT_LIMITS.maxDepth))).toMatchObject({ ok: true })
    expect(checkResult(nested(RESULT_LIMITS.maxDepth + 1))).toMatchObject({
      ok: false,
      reason: expect.stringContaining('niveaux imbriqués')
    })
  })

  it('should_refuse_a_structure_that_contains_itself', () => {
    const loop: Record<string, unknown> = {}
    loop['self'] = loop
    expect(checkResult(loop)).toMatchObject({ ok: false })
  })

  it('should_refuse_a_key_or_a_text_that_is_too_long', () => {
    expect(checkResult({ ['k'.repeat(RESULT_LIMITS.maxKeyChars)]: 1 })).toMatchObject({ ok: true })
    expect(checkResult({ ['k'.repeat(RESULT_LIMITS.maxKeyChars + 1)]: 1 })).toMatchObject({
      ok: false,
      reason: expect.stringContaining('nom de champ')
    })
    expect(checkResult(['x'.repeat(RESULT_LIMITS.maxStringChars + 1)])).toMatchObject({
      ok: false,
      reason: expect.stringContaining('texte')
    })
  })

  it('should_refuse_a_result_larger_than_the_size_limit', () => {
    const line = 'x'.repeat(1000)
    const big = Array.from({ length: 250 }, () => line)
    expect(checkResult(big)).toEqual({ ok: false, reason: 'Résultat refusé : il dépasse 200 Ko.' })
    // La taille se mesure en octets : les caractères accentués comptent double.
    const accents = Array.from({ length: 110 }, () => 'é'.repeat(1000))
    expect(checkResult(accents)).toMatchObject({ ok: false })
  })
})
