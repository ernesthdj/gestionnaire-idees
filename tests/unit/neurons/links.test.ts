import { describe, expect, it } from 'vitest'
import {
  keywords,
  linkFingerprint,
  MAX_CANDIDATES,
  orderedPair,
  rankCandidates,
  type Fiche
} from '../../../src/main/domain/neurons/links'

const fiche = (id: string, text: string, categoryId: string | null = null): Fiche => ({
  id,
  title: id,
  categoryId,
  text
})

describe('rapprochement local des idées (graphe de mots-clés)', () => {
  it('should_keep_meaningful_words_without_accents_or_common_words', () => {
    expect([...keywords('Acheter un écran pour la retouche photo, avec le budget !')]).toEqual([
      'acheter',
      'ecran',
      'retouche',
      'photo',
      'budget'
    ])
  })

  it('should_rank_closest_ideas_first_and_ignore_unrelated_ones', () => {
    const target = fiche('t', 'Acheter un écran pour la retouche photo')
    const ranked = rankCandidates(target, [
      fiche('far', 'Réserver un restaurant pour samedi'),
      fiche('near', 'Mission photo mariage : retouche des images'),
      fiche('mid', 'Ranger le bureau et installer l’écran'),
      target
    ])
    expect(ranked.map((entry) => [entry.fiche.id, entry.alias])).toEqual([
      ['near', 'N1'],
      ['mid', 'N2']
    ])
  })

  it('should_count_same_category_as_related_even_without_shared_words', () => {
    const ranked = rankCandidates(fiche('t', 'Nouvel objectif', 'cat-photo'), [
      fiche('same', 'Portfolio en ligne', 'cat-photo'),
      fiche('other', 'Portfolio en ligne', 'cat-it')
    ])
    expect(ranked.map((entry) => entry.fiche.id)).toEqual(['same'])
  })

  it('should_send_at_most_ten_candidates', () => {
    const others = Array.from({ length: 15 }, (_, index) => fiche(`n${index}`, `photo numéro ${index}`))
    expect(rankCandidates(fiche('t', 'photo'), others)).toHaveLength(MAX_CANDIDATES)
  })

  it('should_fingerprint_the_pair_in_any_order_with_normalized_label', () => {
    expect(orderedPair('b', 'a')).toEqual(['a', 'b'])
    expect(linkFingerprint('a', 'b', 'Financement')).toBe(linkFingerprint('b', 'a', ' financement ! '))
    expect(linkFingerprint('a', 'b', 'photo')).not.toBe(linkFingerprint('a', 'b', 'financement'))
  })
})
