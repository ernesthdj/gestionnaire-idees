import { describe, expect, it } from 'vitest'
import { ProviderError } from '../../../src/main/application/ai/AIProvider'
import { OllamaProvider, type FetchLike } from '../../../src/main/infrastructure/ai/OllamaProvider'
import { CategoryOut } from '../../../src/shared/ai/schemas'

const request = {
  system: [
    { text: 'cadre', cacheable: true },
    { text: 'profil', cacheable: true }
  ],
  user: 'acheter une télé',
  schema: CategoryOut,
  effort: 'low' as const,
  maxTokens: 256
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) })
}

describe('OllamaProvider', () => {
  const base = { baseUrl: 'http://127.0.0.1:11434', model: () => 'qwen-test' }

  it('should_refuse_non_loopback_url_when_constructed', () => {
    expect(() => new OllamaProvider({ ...base, baseUrl: 'http://192.168.1.10:11434' })).toThrow(/local/)
  })

  it('should_report_up_when_model_is_installed', async () => {
    const fetch: FetchLike = () => jsonResponse({ models: [{ name: 'qwen-test:latest' }] })
    await expect(new OllamaProvider({ ...base, fetch }).isAvailable()).resolves.toMatchObject({ up: true })
  })

  it('should_report_missing_model_when_not_downloaded', async () => {
    const fetch: FetchLike = () => jsonResponse({ models: [{ name: 'autre' }] })
    await expect(new OllamaProvider({ ...base, fetch }).isAvailable()).resolves.toMatchObject({
      up: false,
      reason: expect.stringMatching(/non téléchargé/)
    })
  })

  it('should_report_down_when_service_is_not_running', async () => {
    const fetch: FetchLike = () => Promise.reject(new Error('ECONNREFUSED'))
    await expect(new OllamaProvider({ ...base, fetch }).isAvailable()).resolves.toMatchObject({ up: false })
  })

  it('should_send_json_schema_and_parse_content_when_completing', async () => {
    const calls: { url: string; body: string }[] = []
    const fetch: FetchLike = (url, init) => {
      calls.push({ url, body: init?.body ?? '' })
      return jsonResponse({
        model: 'qwen-test',
        message: { content: '{"categorySlug":"achat","nature":"action"}' },
        prompt_eval_count: 40,
        eval_count: 12
      })
    }
    const result = await new OllamaProvider({ ...base, fetch }).complete(request)
    expect(result).toMatchObject({ parsed: { categorySlug: 'achat' }, usage: { inputTokens: 40, outputTokens: 12 } })
    const body = JSON.parse(calls[0]?.body ?? '{}') as { format: { type: string }; stream: boolean; think: boolean }
    expect(body.stream).toBe(false)
    expect(body.think).toBe(false)
    expect(body.format.type).toBe('object')
  })

  it('should_return_null_parsed_when_content_is_not_json', async () => {
    const fetch: FetchLike = () => jsonResponse({ model: 'qwen-test', message: { content: 'pas du json' } })
    await expect(new OllamaProvider({ ...base, fetch }).complete(request)).resolves.toMatchObject({ parsed: null })
  })

  it('should_throw_provider_error_when_service_fails', async () => {
    const fetch: FetchLike = () => jsonResponse({}, false, 500)
    await expect(new OllamaProvider({ ...base, fetch }).complete(request)).rejects.toBeInstanceOf(ProviderError)
  })
})
