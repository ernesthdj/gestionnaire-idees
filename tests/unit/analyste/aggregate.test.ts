import { describe, expect, it } from 'vitest'
import {
  aggregate,
  percentile,
  type AggregateEntry,
  type AiCallFingerprint
} from '../../../src/main/domain/analyste/aggregate'
import { loadWeek } from '../../support/analyste'

const OPTIONS = { repeatThreshold: 5, windowMs: 7 * 86_400_000 }
const byKey = (entries: readonly AggregateEntry[], key: string): AggregateEntry | undefined =>
  entries.find((entry) => entry.key === key)

describe('agrégats de la sonde (spec 019 T019)', () => {
  const week = loadWeek()
  const entries = aggregate(week.observations, week.aiCalls, OPTIONS)

  it('should_rank_the_repeated_type_error_first_when_grouping_errors', () => {
    const first = byKey(entries, 'obs:err:1')
    expect(first?.line).toContain('TypeError')
    expect(first?.line).toContain('src/renderer/src/canvas/buildGraph.ts:212')
    expect(first?.line).toContain('×14')
    expect(first?.sentence).toBe(
      'L’erreur TypeError (src/renderer/src/canvas/buildGraph.ts:212) est survenue 14 fois, sur 7 jours.'
    )
    expect(byKey(entries, 'obs:err:2')?.sentence).toContain('reprise.guide_failed (module reprise')
  })

  it('should_report_only_slow_channels_with_their_median_and_95th_percentile', () => {
    const slow = entries.filter((entry) => entry.type === 'lent')
    expect(slow).toHaveLength(1)
    expect(slow[0]?.line).toMatch(/^ipc\.call reprise:analyze p50=\d+,\d s p95=\d+,\d s ×31$/)
  })

  it('should_flag_the_ai_task_returning_the_same_answer_23_times_when_over_the_threshold', () => {
    const ai = entries.filter((entry) => entry.type === 'ia')
    expect(ai).toHaveLength(1)
    expect(ai[0]?.key).toBe('obs:ia:1')
    expect(ai[0]?.sentence).toBe('La tâche categoriser a rendu 23 fois la même réponse pour la même entrée.')
  })

  it('should_ignore_repetitions_below_the_threshold_or_with_several_outputs', () => {
    const calls: AiCallFingerprint[] = [
      ...Array.from({ length: 4 }, () => ({ kind: 'categoriser', inputFp: 'a', outputFp: 'x' })),
      ...Array.from({ length: 6 }, (_, i) => ({ kind: 'widget', inputFp: 'b', outputFp: `y${i % 2}` })),
      ...Array.from({ length: 9 }, () => ({ kind: 'analyste', inputFp: 'c', outputFp: 'z' }))
    ]
    expect(aggregate([], calls, OPTIONS).filter((entry) => entry.type === 'ia')).toEqual([])
  })

  it('should_detect_back_and_forth_between_the_explorer_and_the_map', () => {
    const back = entries.filter((entry) => entry.type === 'aller')
    expect(back).toHaveLength(1)
    expect(back[0]?.line).toBe('explorateur → carte → explorateur en moins de 10 s ×19')
  })

  it('should_find_the_frequent_sequence_of_three_actions', () => {
    const sequence = byKey(entries, 'obs:seq:1')
    expect(sequence?.line).toBe('neuron.create → link.create → block.create ×42')
    expect(sequence?.sentence).toContain('« idée créée → lien créé → bloc posé »')
  })

  it('should_list_screens_and_actions_of_the_catalogue_never_used', () => {
    const unused = entries.filter((entry) => entry.type === 'inutil').map((entry) => entry.signature)
    expect(unused).toEqual(
      expect.arrayContaining(['inutil|screen|a_valider', 'inutil|action|plan.decide', 'inutil|action|neuron.remove'])
    )
    expect(unused).not.toContain('inutil|screen|carte')
  })

  it('should_give_unique_citable_keys_and_stable_signatures', () => {
    const keys = entries.map((entry) => entry.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.every((key) => /^obs:[a-z]+:\d+$/.test(key))).toBe(true)
    const again = aggregate([...week.observations].reverse(), week.aiCalls, OPTIONS)
    expect(again.map((entry) => entry.signature)).toEqual(entries.map((entry) => entry.signature))
  })

  it('should_send_and_show_neither_fingerprints_nor_pseudonyms_when_aggregating', () => {
    // Ce qui part chez Claude (ligne) et ce qui s'affiche (phrase) : des comptes, jamais une empreinte.
    const text = JSON.stringify(entries.map(({ line, sentence }) => ({ line, sentence })))
    for (const call of week.aiCalls) expect(text).not.toContain(call.inputFp)
    for (const record of week.observations) {
      if (record.subjectRef !== undefined) expect(text).not.toContain(record.subjectRef)
    }
  })

  it('should_return_nothing_but_unused_items_when_the_window_is_empty', () => {
    expect(aggregate([], [], OPTIONS)).toEqual([])
  })

  it('should_compute_nearest_rank_percentiles', () => {
    expect(percentile([], 50)).toBe(0)
    expect(percentile([1, 2, 3, 4], 50)).toBe(2)
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10)
  })
})
