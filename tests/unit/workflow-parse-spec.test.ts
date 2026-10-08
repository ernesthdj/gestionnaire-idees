import { describe, expect, it } from 'vitest'
import { foundationSummary, markerOf, parseSpec } from '../../src/main/domain/workflow/parseSpec'

// Extraits réels des en-têtes du dépôt (formats différents selon l'époque des specs).
const SPEC_001 = `# Feature Specification: Moteur IA hybride

**Feature Branch**: \`001-moteur-ia-hybride\`

**Created**: 2026-09-28

**Status**: Draft — révisé le 2026-09-28 (amendement « Brainstormer », docs/brainstorm/L1b-brainstormer.md)

### User Story 1 - Obtenir une réponse IA fiable, par le bon moteur (Priority: P1)
### User Story 2 - Protéger mes données avant tout envoi externe (Priority: P1)
### User Story 3 - Maîtriser le coût de l'IA (Priority: P2)
`

const SPEC_009 = `# Feature Specification: Carte de structure d'un projet (P1 — outil de chirurgie)

**Feature Branch**: \`009-carte-structure\` · **Created**: 2026-10-04 · **Status**: Validée (vision L1e, arbitrages 20–24)

### User Story 1 - Cartographier un projet (P1)
### User Story 2 - Lire et déplier (P1)
`

const SPEC_022 = `# Feature Specification: Nœuds vivants (spec 022)

**Feature Branch**: \`main\` · **Created**: 2026-10-08 · **Status**: Draft — à valider par mentalyas

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Périmètre | Les quatre cartes |
| D2 | Conservation | Rien n'est perdu |
| D2 | Doublon | compté une fois |

### User Story 1 — Une carte des idées qui flotte et se consulte au clic (Priority: P1) 🎯 MVP
### User Story 3 — La carte de structure vivante (Priority: P3)
Voir docs/brainstorm/L1f-reprise-projet.md et L4d-reprise.md, puis L1f-reprise-projet.md encore.
`

describe('parseSpec', () => {
  it('should_read_title_status_date_and_stories_when_the_spec_uses_the_old_format', () => {
    const spec = parseSpec(SPEC_001)
    expect(spec.title).toBe('Moteur IA hybride')
    expect(spec.createdAt).toBe('2026-09-28')
    expect(spec.statusLine).toMatch(/^Draft — révisé/)
    expect(spec.marker).toBeNull()
    expect(spec.stories).toEqual([
      { number: 1, title: 'Obtenir une réponse IA fiable, par le bon moteur', priority: 1 },
      { number: 2, title: 'Protéger mes données avant tout envoi externe', priority: 1 },
      { number: 3, title: "Maîtriser le coût de l'IA", priority: 2 }
    ])
    expect(spec.citedDocs).toEqual(['L1b-brainstormer.md'])
  })

  it('should_split_the_one_line_header_and_read_short_priorities_when_the_spec_uses_the_compact_format', () => {
    const spec = parseSpec(SPEC_009)
    expect(spec.createdAt).toBe('2026-10-04')
    expect(spec.statusLine).toBe('Validée (vision L1e, arbitrages 20–24)')
    expect(spec.stories.map((story) => [story.number, story.title, story.priority])).toEqual([
      [1, 'Cartographier un projet', 1],
      [2, 'Lire et déplier', 1]
    ])
  })

  it('should_count_distinct_decisions_strip_suffixes_and_dedupe_cited_docs_when_reading_a_recent_spec', () => {
    const spec = parseSpec(SPEC_022)
    expect(spec.title).toBe('Nœuds vivants')
    expect(spec.decisions).toBe(2)
    expect(spec.stories.map((story) => story.title)).toEqual([
      'Une carte des idées qui flotte et se consulte au clic',
      'La carte de structure vivante'
    ])
    expect(spec.stories[1]?.priority).toBe(3)
    expect(spec.citedDocs).toEqual(['L1f-reprise-projet.md', 'L4d-reprise.md'])
  })

  it('should_return_empty_fields_without_throwing_when_the_file_is_malformed', () => {
    const spec = parseSpec('rien de reconnaissable\n<script>alert(1)</script>\n### User Story x — sans numéro')
    expect(spec).toMatchObject({ title: null, statusLine: null, marker: null, decisions: 0, stories: [] })
  })
})

describe('markerOf', () => {
  it('should_recognize_a_marker_when_the_status_starts_with_it_whatever_case_and_accents', () => {
    expect(markerOf('Livrée (2026-10-04)')).toBe('delivered')
    expect(markerOf('livree')).toBe('delivered')
    expect(markerOf('En pause (2026-10-06)')).toBe('paused')
    expect(markerOf('ABANDONNÉE')).toBe('abandoned')
    expect(markerOf('Delivered')).toBe('delivered')
  })

  it('should_ignore_a_marker_word_when_it_is_not_at_the_start', () => {
    expect(markerOf('Draft — US1 livrée, en pause pour US2')).toBeNull()
    expect(markerOf('Validée par mentalyas')).toBeNull()
  })
})

describe('foundationSummary', () => {
  it('should_take_the_first_paragraph_under_the_first_section_when_the_header_is_metadata', () => {
    const text = `# Cahier des Charges\n> Date : 2026-09-28\n\n---\n\n## État actuel\n\n> Résumé de l'app,\n> sur deux lignes.\n- liste\n`
    expect(foundationSummary(text)).toBe("Résumé de l'app, sur deux lignes.")
  })

  it('should_fall_back_to_the_first_paragraph_or_null_when_there_is_no_section', () => {
    expect(foundationSummary('# Titre\n\nUne idée simple.\n')).toBe('Une idée simple.')
    expect(foundationSummary('# Titre seul\n')).toBeNull()
  })
})
