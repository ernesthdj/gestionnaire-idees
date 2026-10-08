import { describe, expect, it } from 'vitest'
import { cardCheck } from '../../../src/main/domain/skills/cardCheck'
import { SkillCard, starsOf } from '../../../src/shared/skills/card'

const card = (patch: Partial<SkillCard> = {}): SkillCard =>
  SkillCard.parse({
    resume: 'Archiviste fictif du workspace.',
    quand: ['Ouvrir une session'],
    eviter: [],
    declencheurs: ['/hub'],
    entrees_sorties: 'Un nom de projet → une session ouverte.',
    exemples: [],
    grille: { declencheurs: 4, profondeur: 3, garde_fous: 5, exemples: 1 },
    justification: { declencheurs: 'a', profondeur: 'b', garde_fous: 'c', exemples: 'd' },
    domaine: 'projet',
    liens: [],
    ...patch
  })

const SKILLS = new Map([
  ['hub', 'perso:hub'],
  ['graphify', 'perso:graphify'],
  ['deploy', 'plugin:m/p:deploy']
])
const DOMAINS = new Set(['projet', 'code', 'divers'])

describe('contrôle d’une fiche de skill (spec 020 T014)', () => {
  it('should_compute_stars_from_the_grid_with_a_minimum_of_one', () => {
    expect(starsOf({ declencheurs: 4, profondeur: 3, garde_fous: 5, exemples: 1 })).toBe(3)
    expect(starsOf({ declencheurs: 5, profondeur: 5, garde_fous: 4, exemples: 4 })).toBe(5)
    expect(starsOf({ declencheurs: 0, profondeur: 0, garde_fous: 0, exemples: 0 })).toBe(1)
  })

  it('should_keep_only_links_to_other_inventoried_skills_without_duplicates', () => {
    const checked = cardCheck({
      card: card({
        liens: [
          { vers: 'graphify', sorte: 'enchaine_vers', raison: 'Cartographie après la session.' },
          { vers: 'graphify', sorte: 'enchaine_vers', raison: 'Doublon.' },
          { vers: 'hub', sorte: 'complete', raison: 'Lien vers soi.' },
          { vers: 'inexistant', sorte: 'alternative_a', raison: 'Skill inconnu.' },
          { vers: 'deploy', sorte: 'complete', raison: 'Plugin.' }
        ]
      }),
      self: 'hub',
      skills: SKILLS,
      domains: DOMAINS
    })
    expect(checked.links).toEqual([
      { to: 'perso:graphify', kind: 'enchaine_vers', reason: 'Cartographie après la session.' },
      { to: 'plugin:m/p:deploy', kind: 'complete', reason: 'Plugin.' }
    ])
    expect(checked.rejectedLinks).toBe(3)
  })

  it('should_propose_an_unknown_domain_only_with_a_label_and_fall_back_otherwise', () => {
    const base = { self: 'hub', skills: SKILLS, domains: DOMAINS }
    expect(cardCheck({ ...base, card: card() }).domain).toEqual({ id: 'projet' })
    expect(
      cardCheck({ ...base, card: card({ domaine: 'photo_rue', nouveau_domaine: 'Photo de rue' }) }).domain
    ).toEqual({ id: 'photo_rue', proposedLabel: 'Photo de rue' })
    expect(cardCheck({ ...base, card: card({ domaine: 'inconnu' }) }).domain).toEqual({ id: 'divers' })
  })

  it('should_reject_a_card_outside_the_closed_schema', () => {
    expect(SkillCard.safeParse({ ...card(), etoiles: 5 }).success).toBe(false)
    expect(SkillCard.safeParse({ ...card(), grille: { ...card().grille, profondeur: 9 } }).success).toBe(false)
    expect(SkillCard.safeParse({ ...card(), domaine: 'Pas Un Id' }).success).toBe(false)
  })
})
