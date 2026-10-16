import { describe, expect, it } from 'vitest'
import {
  mintCharacter,
  mintRoom,
  ROOM_SLOTS,
  ROOM_VARIANTS,
  upgradesFor
} from '../../../src/renderer/src/canvas/agents/character/mint'
import { pick, rng, seedOf, tierRank } from '../../../src/renderer/src/canvas/agents/character/random'
import { METIER, UNIVERSES } from '../../../src/renderer/src/canvas/agents/character/sprites'
import { subtitleOf } from '../../../src/renderer/src/canvas/agents/visioStore'

const PROFILE = '0b8f3c1e-5d2a-4c7b-9e11-2f6a8d4c3b10'

describe('personnage d’un agent (T008, L1o D13)', () => {
  it('should_give_the_same_character_when_minting_the_same_profile_twice', () => {
    const a = mintCharacter(PROFILE, 'backend')
    const b = mintCharacter(PROFILE, 'backend')
    expect([b.universe.key, b.base.name, b.yeux.name, b.coiffe.name, b.objet.name]).toEqual([
      a.universe.key,
      a.base.name,
      a.yeux.name,
      a.coiffe.name,
      a.objet.name
    ])
  })

  it('should_hold_the_trade_object_of_the_role_when_the_role_has_one', () => {
    for (const role of ['po', 'backend', 'frontend', 'qa'] as const) {
      const character = mintCharacter(PROFILE, role)
      expect(character.objet).toBe(METIER[character.universe.key][role])
    }
  })

  it('should_draw_an_object_from_the_universe_when_the_role_has_no_trade_object', () => {
    const character = mintCharacter(PROFILE, 'architecte')
    expect(character.universe.objet).toContain(character.objet)
  })

  it('should_vary_the_character_when_profiles_differ', () => {
    const keys = new Set(
      Array.from({ length: 40 }, (_, i) => {
        const c = mintCharacter(`profil-${i}`, null)
        return `${c.universe.key}/${c.base.name}`
      })
    )
    expect(keys.size).toBeGreaterThan(5)
  })
})

describe('tirage', () => {
  it('should_repeat_the_same_sequence_when_the_seed_is_the_same', () => {
    const a = rng(42)
    const b = rng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('should_give_a_stable_unsigned_seed_when_hashing_a_text', () => {
    expect(seedOf(PROFILE)).toBe(seedOf(PROFILE))
    expect(seedOf(PROFILE)).toBeGreaterThanOrEqual(0)
    expect(seedOf('a')).not.toBe(seedOf('b'))
  })

  it('should_pick_common_variants_more_often_when_drawing_many_times', () => {
    const r = rng(7)
    const list = UNIVERSES[0]?.base ?? []
    const counts = new Map<string, number>()
    for (let i = 0; i < 4000; i++) {
      const v = pick(r, list)
      counts.set(v.tier, (counts.get(v.tier) ?? 0) + 1)
    }
    expect(counts.get('commun') ?? 0).toBeGreaterThan(counts.get('legend') ?? 0)
  })
})

describe('chambre', () => {
  it('should_have_every_layer_when_minting_a_room', () => {
    const room = mintRoom(seedOf(PROFILE), 0)
    for (const slot of ROOM_SLOTS) {
      expect(ROOM_VARIANTS[slot].map((v) => v.name)).toContain(room.traits[slot].name)
    }
    expect(room.upgrades).toBe(0)
  })

  it('should_count_upgrades_at_1_3_6_10_when_work_is_delivered', () => {
    expect([0, 1, 2, 3, 5, 6, 9, 10].map(upgradesFor)).toEqual([0, 1, 1, 2, 2, 3, 3, 4])
  })

  it('should_never_lower_a_layer_when_more_work_is_delivered', () => {
    const seed = seedOf(PROFILE)
    let previous = mintRoom(seed, 0)
    for (const delivered of [1, 3, 6, 10, 15, 21]) {
      const room = mintRoom(seed, delivered)
      for (const slot of ROOM_SLOTS) {
        expect(tierRank(room.traits[slot].tier)).toBeGreaterThanOrEqual(tierRank(previous.traits[slot].tier))
      }
      previous = room
    }
  })

  it('should_stop_upgrading_when_every_layer_is_at_the_rarest_tier', () => {
    const room = mintRoom(seedOf(PROFILE), 100_000)
    for (const slot of ROOM_SLOTS) expect(room.traits[slot].tier).toBe('legend')
    expect(room.rank).toBe('legend')
  })
})

describe('sous-titres de la visio (L1o D13)', () => {
  it('should_keep_the_end_of_the_answer_without_markdown_when_it_is_long', () => {
    expect(subtitleOf('**Salut** ! Je `trie` la liste.')).toBe('Salut ! Je trie la liste.')
    const long = subtitleOf(`${'mot '.repeat(60)}fin de la phrase`, 40)
    expect(long.startsWith('…')).toBe(true)
    expect(long.endsWith('fin de la phrase')).toBe(true)
    expect(long.length).toBeLessThanOrEqual(41)
  })
})
