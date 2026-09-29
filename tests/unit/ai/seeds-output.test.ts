import { describe, expect, it } from 'vitest'
import { GermerOut, SuggererLiensOut } from '../../../src/shared/ai/neurons'
import { effortFor, resolveEngine, DEFAULT_ROUTING } from '../../../src/main/domain/ai/routing'

const link = { targetAlias: 'N1', label: 'financement', justification: 'L’acompte paie l’écran.' }
const seed = { title: 'Faire financer l’écran par la mission', why: 'L’acompte paie l’outil.' }

describe('sorties IA des graines (FR-028)', () => {
  it('should_keep_a_well_formed_seed_on_its_link', () => {
    expect(SuggererLiensOut.parse({ links: [{ ...link, seed }] }).links[0]?.seed).toEqual(seed)
  })

  it('should_accept_links_without_seed', () => {
    expect(SuggererLiensOut.parse({ links: [link] }).links[0]?.seed).toBeUndefined()
  })

  it('should_drop_a_malformed_seed_but_keep_the_link_when_title_is_empty_or_why_too_long', () => {
    const parsed = SuggererLiensOut.parse({
      links: [
        { ...link, seed: { title: '', why: 'x' } },
        { ...link, targetAlias: 'N2', seed: { title: 'Idée', why: 'x'.repeat(201) } }
      ]
    })
    expect(parsed.links).toHaveLength(2)
    expect(parsed.links.every((entry) => entry.seed === undefined)).toBe(true)
  })

  it('should_parse_zero_or_one_seed_for_germer', () => {
    expect(GermerOut.parse({}).seed).toBeUndefined()
    expect(GermerOut.parse({ seed }).seed).toEqual(seed)
    expect(GermerOut.parse({ seed: 'n’importe quoi' }).seed).toBeUndefined()
  })

  it('should_route_germer_to_the_local_engine_with_low_effort', () => {
    expect(resolveEngine('germer', DEFAULT_ROUTING)).toBe('ollama')
    expect(effortFor('germer')).toBe('low')
  })
})
