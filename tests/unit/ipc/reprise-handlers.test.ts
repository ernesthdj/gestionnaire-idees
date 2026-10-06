import { describe, expect, it, vi } from 'vitest'
import type { AnalysisService } from '../../../src/main/application/reprise/AnalysisService'
import type { RepriseService } from '../../../src/main/application/reprise/RepriseService'
import { createRepriseRoutes } from '../../../src/main/ipc/repriseHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'

const ID = '00000000-0000-4000-8000-0000000000e1'

function setup() {
  const service = {
    previewFolder: vi.fn(async () => null),
    create: vi.fn(async () => ({ genesisId: ID })),
    view: vi.fn(),
    setConfidentiality: vi.fn((_id: string, level: string) => ({ level }))
  }
  const analysis = {
    analyze: vi.fn(() => ({ runId: 'r1' })),
    cancel: vi.fn(),
    setCategory: vi.fn(),
    setTarget: vi.fn()
  }
  const dispatch = createDispatcher(
    createRepriseRoutes(service as unknown as RepriseService, analysis as unknown as AnalysisService)
  )
  return { dispatch, service, analysis }
}

describe('canaux reprise:* (spec 017 US1)', () => {
  it('should_create_with_an_explicit_confidentiality_and_pass_the_confirmation', async () => {
    const { dispatch, service } = setup()
    expect(await dispatch('reprise:create', { previewId: ID, confidentiality: 'local' })).toMatchObject({
      success: true,
      data: { genesisId: ID }
    })
    await dispatch('reprise:setConfidentiality', { genesisId: ID, level: 'claude', confirm: true })
    expect(service.create).toHaveBeenCalledWith(ID, 'local')
    expect(service.setConfidentiality).toHaveBeenCalledWith(ID, 'claude', true)
  })

  it.each([
    ['reprise:create', { previewId: ID }],
    ['reprise:create', { previewId: ID, confidentiality: 'public' }],
    ['reprise:create', { previewId: ID, confidentiality: 'local', root: 'C:/Windows' }],
    ['reprise:previewFolder', { path: 'C:/' }],
    ['reprise:get', { genesisId: 'pas-un-uuid' }],
    ['reprise:setConfidentiality', { genesisId: ID, level: 'claude', confirm: 'oui' }]
  ] as const)('should_refuse_%s_with_an_invalid_payload_%#', async (channel, payload) => {
    const { dispatch, service } = setup()
    expect(await dispatch(channel, payload)).toMatchObject({ success: false, error: { code: 'VALIDATION' } })
    expect(service.create).not.toHaveBeenCalled()
    expect(service.previewFolder).not.toHaveBeenCalled()
  })

  it('should_pass_analysis_requests_and_corrections_with_valid_identifiers_only', async () => {
    const { dispatch, analysis } = setup()
    const symbol = 'a'.repeat(32)
    expect(await dispatch('reprise:analyze', { genesisId: ID })).toMatchObject({ success: true, data: { runId: 'r1' } })
    await dispatch('reprise:setCategory', { genesisId: ID, symbolId: symbol, category: 'plumbing' })
    await dispatch('reprise:setTarget', { genesisId: ID, edgeId: symbol, targetSymbolId: null })
    expect(analysis.setCategory).toHaveBeenCalledWith(ID, symbol, 'plumbing')
    expect(analysis.setTarget).toHaveBeenCalledWith(ID, symbol, null)
    for (const payload of [
      { genesisId: ID, symbolId: '../x', category: 'domain' },
      { genesisId: ID, symbolId: symbol, category: 'secret' }
    ]) {
      expect(await dispatch('reprise:setCategory', payload)).toMatchObject({ success: false })
    }
    expect(analysis.setCategory).toHaveBeenCalledTimes(1)
  })
})
