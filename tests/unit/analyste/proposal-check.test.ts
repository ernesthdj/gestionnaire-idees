import { describe, expect, it } from 'vitest'
import type { AggregateEntry } from '../../../src/main/domain/analyste/aggregate'
import {
  checkProposals,
  dedupeKeyOf,
  normalizeRepoPath,
  type CheckInput
} from '../../../src/main/domain/analyste/proposalCheck'
import { AnalysteOut, type AnalysteProposalOut } from '../../../src/shared/analyste/proposals'

const FILES = new Set(['src/renderer/src/canvas/buildGraph.ts', 'src/main/domain/ai/routing.ts', 'src/a.ts'])

const entry = (key: string, signature: string): AggregateEntry => ({
  key,
  type: key.split(':')[1] as AggregateEntry['type'],
  line: key,
  sentence: `Phrase de ${key}.`,
  signature
})
const ENTRIES = new Map(
  [entry('obs:err:1', 'err|TypeError'), entry('obs:ia:1', 'ia|categoriser|aaa'), entry('obs:err:2', 'err|Other')].map(
    (item) => [item.key, item]
  )
)

const proposal = (overrides: Partial<AnalysteProposalOut> = {}): AnalysteProposalOut => ({
  categorie: 'bug',
  titre: 'Corriger le TypeError de buildGraph',
  constat: 'Erreur répétée.',
  preuves: {
    observations: ['obs:err:1'],
    code: [{ chemin: 'src/renderer/src/canvas/buildGraph.ts', debut: 200, fin: 220 }]
  },
  proposition: 'Vérifier la valeur avant usage.',
  gain: 'Plus de plantage de la carte.',
  risque: 'faible',
  gravite: 3,
  confiance: 0.8,
  fichiersVises: ['src/renderer/src/canvas/buildGraph.ts'],
  ...overrides
})

const check = (proposals: AnalysteProposalOut[], overrides: Partial<CheckInput> = {}) =>
  checkProposals({ proposals, entries: ENTRIES, exists: (path) => FILES.has(path), memory: [], max: 5, ...overrides })

describe('contrôle des propositions (spec 019 T021)', () => {
  it('should_keep_a_proposal_whose_evidence_exists_with_readable_sentences', () => {
    const { kept, rejected } = check([proposal()])
    expect(rejected).toEqual([])
    expect(kept).toHaveLength(1)
    expect(kept[0]).toMatchObject({
      category: 'bug',
      files: ['src/renderer/src/canvas/buildGraph.ts'],
      withoutEvidence: false,
      evidence: {
        observations: [{ key: 'obs:err:1', sentence: 'Phrase de obs:err:1.', signature: 'err|TypeError' }],
        code: [{ path: 'src/renderer/src/canvas/buildGraph.ts', start: 200, end: 220 }]
      }
    })
  })

  it('should_reject_an_invented_file_or_a_path_outside_the_repository', () => {
    for (const bad of [
      'src/invente.ts',
      '../autre/a.ts',
      'C:/Users/x/AppData/Roaming/a.db',
      '/etc/passwd',
      '.git/config'
    ]) {
      expect(check([proposal({ fichiersVises: [bad] })]).rejected).toEqual([
        { title: 'Corriger le TypeError de buildGraph', reason: 'invalid_path' }
      ])
    }
    const badEvidence = proposal({ preuves: { observations: [], code: [{ chemin: 'src/../../x.ts' }] } })
    expect(check([badEvidence]).rejected[0]?.reason).toBe('invalid_path')
  })

  it('should_reject_an_observation_key_that_was_not_in_the_dossier', () => {
    const result = check([proposal({ preuves: { observations: ['obs:err:9'], code: [] } })])
    expect(result.kept).toEqual([])
    expect(result.rejected[0]?.reason).toBe('unknown_key')
  })

  it('should_reject_a_proposal_without_evidence_except_scalability_marked_as_an_idea', () => {
    const none = { observations: [], code: [] }
    expect(check([proposal({ preuves: none })]).rejected[0]?.reason).toBe('no_evidence')
    const idea = check([proposal({ categorie: 'evolutivite', preuves: none, fichiersVises: [] })])
    expect(idea.kept[0]?.withoutEvidence).toBe(true)
  })

  it('should_reject_ai_to_code_without_a_cited_repetition', () => {
    const noRepeat = proposal({ categorie: 'ia_vers_code', preuves: { observations: ['obs:err:1'], code: [] } })
    expect(check([noRepeat]).rejected[0]?.reason).toBe('ia_without_repetition')
    const repeated = proposal({
      categorie: 'ia_vers_code',
      preuves: { observations: ['obs:ia:1'], code: [] },
      fichiersVises: ['src/main/domain/ai/routing.ts']
    })
    expect(check([repeated]).kept).toHaveLength(1)
  })

  it('should_merge_two_proposals_of_the_same_category_on_the_same_files', () => {
    const { kept } = check([
      proposal({ gravite: 2 }),
      proposal({ titre: 'Autre angle sur buildGraph', gravite: 4, preuves: { observations: ['obs:err:2'], code: [] } })
    ])
    expect(kept).toHaveLength(1)
    expect(kept[0]?.title).toBe('Autre angle sur buildGraph')
    expect(kept[0]?.evidence.observations.map((item) => item.key)).toEqual(['obs:err:2', 'obs:err:1'])
  })

  it('should_drop_a_duplicate_of_an_open_proposal', () => {
    const key = dedupeKeyOf('bug', ['src/renderer/src/canvas/buildGraph.ts'], 'peu importe')
    const result = check([proposal()], { memory: [{ dedupeKey: key, status: 'postponed', signatures: [] }] })
    expect(result.rejected[0]?.reason).toBe('duplicate')
  })

  it('should_not_repropose_a_refused_proposal_without_a_new_fact', () => {
    const key = dedupeKeyOf('bug', ['src/renderer/src/canvas/buildGraph.ts'], '')
    const memory = [{ dedupeKey: key, status: 'refused', signatures: ['err|TypeError'] }]
    expect(check([proposal()], { memory }).rejected[0]?.reason).toBe('refused_before')
    const withNewFact = proposal({ preuves: { observations: ['obs:err:1', 'obs:err:2'], code: [] } })
    expect(check([withNewFact], { memory }).kept).toHaveLength(1)
    // Une proposition close (gardée, jetée) n'empêche pas d'en refaire une semblable.
    expect(check([proposal()], { memory: [{ dedupeKey: key, status: 'kept', signatures: [] }] }).kept).toHaveLength(1)
  })

  it('should_keep_at_most_the_limit_most_severe_first', () => {
    const many = [1, 4, 2, 3].map((gravite, i) =>
      proposal({
        gravite,
        titre: `Proposition numéro ${i}`,
        fichiersVises: [],
        preuves: { observations: ['obs:err:1'], code: [] }
      })
    )
    // Fichiers vides : chaque titre fait sa propre empreinte.
    const { kept, rejected } = check(many, { max: 2 })
    expect(kept.map((item) => item.severity)).toEqual([4, 3])
    expect(rejected.filter((item) => item.reason === 'over_limit')).toHaveLength(2)
  })

  it('should_normalize_relative_paths_and_refuse_dangerous_ones', () => {
    expect(normalizeRepoPath('./src\\main\\a.ts')).toBe('src/main/a.ts')
    expect(normalizeRepoPath('src/main/')).toBe('src/main')
    for (const bad of [
      '',
      '..',
      'a/../b',
      '~/x',
      'D:x',
      'node_modules/x/index.js',
      '.analyste/worktrees/a',
      'a\u0000b'
    ]) {
      expect(normalizeRepoPath(bad)).toBeNull()
    }
  })

  it('should_reject_an_output_with_extra_fields_or_an_unknown_category_at_the_schema', () => {
    expect(AnalysteOut.safeParse({ propositions: [proposal()] }).success).toBe(true)
    expect(AnalysteOut.safeParse({ propositions: [{ ...proposal(), commande: 'rm -rf' }] }).success).toBe(false)
    expect(AnalysteOut.safeParse({ propositions: [{ ...proposal(), categorie: 'securite' }] }).success).toBe(false)
    expect(AnalysteOut.safeParse({ propositions: [proposal()], extra: 1 }).success).toBe(false)
    expect(
      AnalysteOut.safeParse({ propositions: [proposal({ preuves: { observations: ['obs:ERR:1'], code: [] } })] })
        .success
    ).toBe(false)
  })
})
