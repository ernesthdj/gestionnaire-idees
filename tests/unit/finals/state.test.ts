import { describe, expect, it } from 'vitest'
import { nextFinalState, type FinalCommand, type FinalState } from '../../../src/main/domain/finals/state'

describe('cycle de vie d’une action finale (spec 013)', () => {
  it.each<[FinalState, FinalCommand, FinalState | 'archived']>([
    ['proposee', 'accept', 'prete'],
    ['proposee', 'refuse', 'archived'],
    ['prete', 'execute', 'en_cours'],
    ['prete', 'demote', 'archived'],
    ['en_cours', 'finish', 'a_revoir'],
    ['a_revoir', 'execute', 'en_cours'],
    ['a_revoir', 'demote', 'archived']
  ])('should_go_from_%s_with_%s_to_%s', (state, command, next) => {
    expect(nextFinalState(state, command)).toBe(next)
  })

  it.each<[FinalState, FinalCommand]>([
    ['proposee', 'execute'],
    ['prete', 'accept'],
    ['en_cours', 'demote'],
    ['en_cours', 'execute'],
    ['a_revoir', 'refuse']
  ])('should_refuse_%s_then_%s', (state, command) => {
    expect(nextFinalState(state, command)).toBeNull()
  })
})
