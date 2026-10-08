import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { SkillCardSheet } from '../../../src/renderer/src/skills/SkillCardSheet'
import { SkillsPage } from '../../../src/renderer/src/skills/SkillsPage'
import type { SkillCardsView, SkillsView, SkillView } from '../../../src/shared/ipc/skills'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const LINK_ID = '3b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f'

const skill = (id: string): SkillView => ({
  id,
  family: 'perso',
  name: id.split(':').at(-1) ?? id,
  description: `Description fictive de ${id}`,
  origin: 'personnel',
  hasScripts: false,
  damaged: false,
  sameNameAs: [],
  modifiedAt: 1,
  contentHash: 'abc'
})

const VIEW: SkillsView = {
  skills: [skill('perso:hub'), skill('perso:graphify'), skill('perso:sans-fiche')],
  links: [],
  scannedAt: 1
}

const CARDS: SkillCardsView = {
  cards: {
    'perso:hub': {
      skillId: 'perso:hub',
      card: {
        resume: 'Archiviste fictif du workspace.',
        quand: ['Ouvrir une session de travail'],
        eviter: ['Écrire du code'],
        declencheurs: ['/hub work'],
        entrees_sorties: 'Un nom de projet → une session ouverte.',
        exemples: ['/hub status'],
        grille: { declencheurs: 4, profondeur: 3, garde_fous: 5, exemples: 2 },
        justification: {
          declencheurs: 'Commandes listées.',
          profondeur: 'Protocoles détaillés.',
          garde_fous: 'Confirmation avant git.',
          exemples: 'Peu d’exemples.'
        },
        domaine: 'projet',
        liens: []
      },
      stars: 4,
      starsClaude: 4,
      starsUser: null,
      domainId: 'projet',
      domainSource: 'claude',
      analyzedAt: 1,
      model: 'claude-sonnet-5-5',
      stale: false
    }
  },
  domains: [
    { id: 'projet', label: 'Projet & organisation', position: 0, pending: false },
    { id: 'code', label: 'Code & qualité', position: 1, pending: false }
  ],
  links: [
    {
      id: LINK_ID,
      from: 'perso:hub',
      to: 'perso:graphify',
      kind: 'enchaine_vers',
      origin: 'claude',
      reason: 'Cartographie.'
    }
  ]
}

const wrap = (node: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {node}
  </QueryClientProvider>
)

describe('fiche technique d’un skill (spec 020 T018)', () => {
  beforeAll(() => installReactFlowMocks())

  it('should_show_the_card_grid_and_usage_and_send_only_identifiers_for_corrections', async () => {
    const setStars = vi.fn(() => ({ batchId: 'b1' }))
    const unlink = vi.fn(() => ({ batchId: 'b2' }))
    installFakeApi({ 'skills:setStars': setStars, 'skills:unlink': unlink })
    const { container } = render(
      wrap(
        <SkillCardSheet
          skillId="perso:hub"
          view={VIEW}
          cards={CARDS}
          usage={{ calls30d: 12, lastAt: Date.parse('2026-10-07T10:00:00Z') }}
          onSelect={() => undefined}
        />
      )
    )
    expect(screen.getByText('Archiviste fictif du workspace.')).toBeTruthy()
    expect(screen.getByText(/12 appels sur 30 jours/)).toBeTruthy()
    expect(screen.getByText('/hub work')).toBeTruthy()
    const grid = screen.getByRole('region', { name: 'Grille de qualité' })
    expect(within(grid).getAllByRole('meter')).toHaveLength(4)
    expect(within(grid).getByText('Confirmation avant git.')).toBeTruthy()
    expect(screen.getByText(/\(grille de Claude\)/)).toBeTruthy()
    await expectNoAxeViolations(container)
    await userEvent.click(screen.getByRole('button', { name: '2 ★' }))
    expect(setStars).toHaveBeenCalledWith({ skillId: 'perso:hub', stars: 2 })
    await userEvent.click(screen.getByRole('button', { name: 'Retirer le lien vers graphify' }))
    expect(unlink).toHaveBeenCalledWith({ linkId: LINK_ID })
  })

  it('should_offer_an_analysis_when_the_skill_has_no_card', async () => {
    const analyze = vi.fn(() => ({ analysisId: 'a1', total: 1 }))
    installFakeApi({ 'skills:analyze': analyze })
    render(
      wrap(
        <SkillCardSheet
          skillId="perso:sans-fiche"
          view={VIEW}
          cards={CARDS}
          usage={undefined}
          onSelect={() => undefined}
        />
      )
    )
    expect(screen.getByText(/aucun appel sur 30 jours/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Analyser ce skill' }))
    expect(analyze).toHaveBeenCalledWith({ skillIds: ['perso:sans-fiche'] })
  })

  it('should_arrange_the_tree_by_domain_with_stars_once_cards_exist', async () => {
    installFakeApi({
      'skills:list': () => VIEW,
      'skills:cards': () => CARDS,
      'skills:usage': () => ({ 'perso:hub': { calls30d: 12, lastAt: 1 } })
    })
    const { container } = render(wrap(<SkillsPage />))
    expect(await screen.findByText(/Projet & organisation · 1/)).toBeTruthy()
    expect(screen.getByText(/À analyser · 2/)).toBeTruthy()
    expect(screen.getByText('12×')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Analyser les skills' })).toBeTruthy()
    await expectNoAxeViolations(container)
  })
})
