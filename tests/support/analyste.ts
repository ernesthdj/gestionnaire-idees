import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AiCallFingerprint } from '../../src/main/domain/analyste/aggregate'
import type { ObservationRecord } from '../../src/shared/analyste/events'

export interface ObservationWeek {
  readonly from: number
  readonly to: number
  readonly observations: ObservationRecord[]
  readonly aiCalls: (AiCallFingerprint & { readonly at: number; readonly status: string })[]
}

/** Semaine d'observations fictive de la sonde (spec 019 T003). */
export function loadWeek(): ObservationWeek {
  return JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../fixtures/analyste/observations-semaine.json'), 'utf8')
  ) as ObservationWeek
}
