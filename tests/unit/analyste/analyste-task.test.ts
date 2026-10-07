import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { runAnalyste } from '../../../src/main/application/ai/AnalysteTask'
import { engineFor, timeoutFor } from '../../../src/main/domain/ai/routing'
import { fingerprint } from '../../../src/main/domain/analyste/fingerprint'
import { ANALYSTE_FRAME } from '../../../src/main/infrastructure/ai/AnalysteFrame'
import { createGatewayHarness } from '../../support/gateway'

const PROPOSAL = {
  categorie: 'bug',
  titre: 'Corriger le TypeError',
  constat: 'Erreur répétée.',
  preuves: { observations: ['obs:err:1'], code: [] },
  proposition: 'Vérifier la valeur.',
  gain: 'Moins de plantages.',
  risque: 'faible',
  gravite: 3,
  confiance: 0.7,
  fichiersVises: []
}
const OPTIONS = { repoPath: 'D:/dev/brainstormer', requestId: 'req-1' }

describe('tâche analyste (spec 019 T022)', () => {
  it('should_route_to_claude_with_a_long_timeout', () => {
    expect(engineFor('analyste')).toBe('claude')
    expect(timeoutFor('analyste')).toBe(15 * 60 * 1000)
  })

  it('should_send_the_fixed_frame_the_tagged_dossier_and_the_read_only_repository', async () => {
    const h = createGatewayHarness()
    h.claude.enqueue({ raw: { propositions: [PROPOSAL] } })
    const result = await runAnalyste(h.gateway, '<dossier version="1"></dossier>', OPTIONS)
    expect(result.ok).toBe(true)
    const request = h.claude.requests[0]
    expect(request?.system).toEqual([{ text: ANALYSTE_FRAME, cacheable: true, role: 'frame' }])
    expect(request?.user).toContain('<donnees_utilisateur>\n<dossier version="1"></dossier>\n</donnees_utilisateur>')
    expect(request).toMatchObject({ task: 'analyste', tools: 'read-only', cwd: OPTIONS.repoPath })
    expect(h.calls[0]).toMatchObject({ requestId: 'req-1', kind: 'analyste', status: 'ok' })
  })

  it('should_reject_an_invalid_output_entirely_and_log_it', async () => {
    const h = createGatewayHarness()
    const invalid = { raw: { propositions: [{ ...PROPOSAL, commande: 'npm publish' }] } }
    h.claude.enqueue(invalid, invalid)
    const result = await runAnalyste(h.gateway, 'dossier', OPTIONS)
    expect(result).toMatchObject({ ok: false, error: { code: 'AI_INVALID_OUTPUT' } })
    expect(h.calls.map((call) => call.status)).toEqual(['invalid', 'invalid'])
  })

  it('should_never_queue_nor_fall_back_to_the_local_model_when_claude_is_down', async () => {
    const h = createGatewayHarness({ config: () => ({ allowClaudeFallback: true }) })
    h.claude.setAvailable(false)
    const result = await runAnalyste(h.gateway, 'dossier', OPTIONS)
    expect(result).toMatchObject({ ok: false, error: { code: 'AI_UNAVAILABLE' } })
    expect(h.ollama.requests).toHaveLength(0)
    expect(h.queued).toHaveLength(0)
  })

  it('should_refuse_a_read_only_repository_for_any_other_task_at_the_gateway', async () => {
    const h = createGatewayHarness()
    const result = await h.gateway.run({
      kind: 'widget',
      input: 'x',
      schema: z.object({ ok: z.boolean() }),
      readOnlyRepo: 'D:/dev/brainstormer'
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'AI_UNAVAILABLE' } })
    expect(h.claude.requests).toHaveLength(0)
  })
})

describe('empreintes dans la passerelle (spec 019 T018)', () => {
  const Out = z.object({ categorySlug: z.string(), nature: z.string() })
  const KEY = 'k'.repeat(64)

  it('should_write_input_and_output_fingerprints_after_validation_when_the_probe_is_active', async () => {
    const h = createGatewayHarness({ fingerprintKey: () => KEY })
    const reply = { categorySlug: 'achat', nature: 'action' }
    h.ollama.enqueue({ raw: reply }, { raw: reply })
    await h.gateway.run({ kind: 'categoriser', input: 'Acheter du pain', schema: Out })
    await h.gateway.run({ kind: 'categoriser', input: '  Acheter du pain ', schema: Out })
    const [first, second] = h.calls
    expect(first?.inputFp).toBe(fingerprint(KEY, 'categoriser', '1', { input: 'Acheter du pain', verbatim: null }))
    expect(first?.outputFp).toBe(fingerprint(KEY, 'categoriser', '1', reply))
    // Même entrée (aux espaces près) → même empreinte : un travail refait se repère sans contenu.
    expect(second?.inputFp).toBe(first?.inputFp)
    expect(first?.inputFp).toMatch(/^[0-9a-f]{16}$/)
    expect(JSON.stringify(h.calls)).not.toContain('pain')
  })

  it('should_write_no_fingerprint_when_the_probe_is_inactive_or_the_output_is_invalid', async () => {
    const inactive = createGatewayHarness({ fingerprintKey: () => null })
    inactive.ollama.enqueue({ raw: { categorySlug: 'achat', nature: 'action' } })
    await inactive.gateway.run({ kind: 'categoriser', input: 'x', schema: Out })
    expect(inactive.calls[0]?.inputFp).toBeUndefined()

    const invalid = createGatewayHarness({ fingerprintKey: () => KEY })
    invalid.ollama.enqueue({ raw: { nope: 1 } }, { raw: { nope: 2 } })
    await invalid.gateway.run({ kind: 'categoriser', input: 'x', schema: Out })
    expect(invalid.calls.map((call) => call.inputFp)).toEqual([undefined, undefined])
  })
})
