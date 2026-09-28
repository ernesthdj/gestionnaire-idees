import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { FakeProvider } from '../../support/FakeProvider'

const schema = z.object({ category: z.enum(['achat', 'photo']) })
const request = { system: [], user: 'x', schema, maxTokens: 256 }

describe('FakeProvider', () => {
  it('should_return_parsed_output_when_reply_matches_schema', async () => {
    const provider = new FakeProvider('ollama', [{ raw: { category: 'achat' } }])
    await expect(provider.complete(request)).resolves.toMatchObject({ parsed: { category: 'achat' } })
    expect(provider.requests).toHaveLength(1)
  })

  it('should_return_null_parsed_when_reply_does_not_match_schema', async () => {
    const provider = new FakeProvider('claude', [{ raw: { category: 'poème' } }])
    await expect(provider.complete(request)).resolves.toMatchObject({ parsed: null })
  })

  it('should_throw_when_provider_is_unavailable', async () => {
    const provider = new FakeProvider('ollama', [{ raw: { category: 'achat' } }])
    provider.setAvailable(false)
    await expect(provider.isAvailable()).resolves.toMatchObject({ up: false })
    await expect(provider.complete(request)).rejects.toThrow(/indisponible/)
  })
})
