import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import { ProviderError } from '../../../src/main/application/ai/AIProvider'
import { ClaudeProvider, type ClaudeClient } from '../../../src/main/infrastructure/ai/ClaudeProvider'
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

describe('ClaudeProvider', () => {
  function clientReturning(message: object): { client: ClaudeClient; parse: ReturnType<typeof vi.fn> } {
    const parse = vi.fn().mockResolvedValue(message)
    return { client: { beta: { messages: { parse } } } as unknown as ClaudeClient, parse }
  }
  const okMessage = {
    model: 'claude-opus-5',
    stop_reason: 'end_turn',
    parsed_output: { categorySlug: 'photo', nature: 'reflection' },
    usage: { input_tokens: 900, output_tokens: 30, cache_read_input_tokens: 800 }
  }

  it('should_be_unavailable_when_no_api_key_is_configured', async () => {
    const provider = new ClaudeProvider({ apiKey: () => null, model: () => 'claude-opus-5' })
    await expect(provider.isAvailable()).resolves.toMatchObject({ up: false })
  })

  it('should_enable_server_fallback_cache_and_adaptive_thinking_when_model_is_opus_5', async () => {
    const { client, parse } = clientReturning(okMessage)
    const provider = new ClaudeProvider({
      apiKey: () => 'sk-ant-test',
      model: () => 'claude-opus-5',
      createClient: () => client
    })
    const result = await provider.complete(request)
    expect(result).toMatchObject({ parsed: { categorySlug: 'photo' }, usage: { cacheReadTokens: 800 } })
    const params = parse.mock.calls[0]?.[0] as Record<string, unknown> & { system: { cache_control?: unknown }[] }
    expect(params).toMatchObject({
      model: 'claude-opus-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' }
    })
    expect(params.system[0]?.cache_control).toBeUndefined()
    expect(params.system[1]?.cache_control).toEqual({ type: 'ephemeral' })
  })

  it('should_not_send_fallbacks_when_model_has_no_server_fallback', async () => {
    const { client, parse } = clientReturning({ ...okMessage, model: 'claude-sonnet-5' })
    const provider = new ClaudeProvider({
      apiKey: () => 'k',
      model: () => 'claude-sonnet-5',
      createClient: () => client
    })
    await provider.complete(request)
    expect(parse.mock.calls[0]?.[0]).not.toHaveProperty('fallbacks')
  })

  it('should_return_refusal_without_parsed_output_when_chain_refuses', async () => {
    const { client } = clientReturning({ ...okMessage, stop_reason: 'refusal', parsed_output: null })
    const provider = new ClaudeProvider({ apiKey: () => 'k', model: () => 'claude-opus-5', createClient: () => client })
    await expect(provider.complete(request)).resolves.toMatchObject({ parsed: null, stopReason: 'refusal' })
  })

  it('should_map_authentication_error_to_auth_failed', async () => {
    const parse = vi.fn().mockRejectedValue(new Anthropic.AuthenticationError(401, undefined, 'bad key', new Headers()))
    const client = { beta: { messages: { parse } } } as unknown as ClaudeClient
    const provider = new ClaudeProvider({ apiKey: () => 'k', model: () => 'claude-opus-5', createClient: () => client })
    await expect(provider.complete(request)).rejects.toMatchObject({ code: 'AUTH_FAILED' })
  })
})

describe('ClaudeProvider.research', () => {
  const researchRequest = {
    system: [{ text: 'cadre', cacheable: true }],
    user: 'Prix d’un écran 27 pouces IPS ?',
    maxTokens: 2000,
    maxSearches: 2
  }
  const usage = (searches: number) => ({
    input_tokens: 5000,
    output_tokens: 200,
    server_tool_use: { web_search_requests: searches }
  })
  const search = {
    type: 'server_tool_use',
    id: 'srvtoolu_1',
    name: 'web_search',
    input: { query: 'écran 27 IPS prix' }
  }
  const results = { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [] }
  const cite = (url: string) => ({
    type: 'web_search_result_location',
    url,
    title: `Titre ${url}`,
    cited_text: '…',
    encrypted_index: 'x'
  })

  function clientCreating(...messages: object[]) {
    const create = vi.fn()
    for (const message of messages) create.mockResolvedValueOnce(message)
    return { client: { beta: { messages: { create } } } as unknown as ClaudeClient, create }
  }

  it('should_search_localized_in_belgium_and_return_final_text_with_deduplicated_sources', async () => {
    const { client, create } = clientCreating({
      model: 'claude-opus-5',
      stop_reason: 'end_turn',
      usage: usage(1),
      content: [
        { type: 'text', text: 'Je cherche.', citations: null },
        search,
        results,
        { type: 'text', text: 'Compte 220 à 300 €', citations: [cite('https://a.be')] },
        { type: 'text', text: ' selon le modèle.', citations: [cite('https://a.be'), cite('https://b.be')] }
      ]
    })
    const provider = new ClaudeProvider({ apiKey: () => 'k', model: () => 'claude-opus-5', createClient: () => client })
    const result = await provider.research(researchRequest)
    expect(result.text).toBe('Compte 220 à 300 € selon le modèle.')
    expect(result.sources.map((source) => source.url)).toEqual(['https://a.be', 'https://b.be'])
    expect(result.usage.webSearches).toBe(1)
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      tools: [{ type: 'web_search_20260209', max_uses: 2, user_location: { country: 'BE' } }]
    })
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty('output_config.format')
  })

  it('should_resume_after_pause_turn_by_sending_back_the_assistant_content', async () => {
    const paused = { model: 'claude-opus-5', stop_reason: 'pause_turn', usage: usage(1), content: [search] }
    const done = {
      model: 'claude-opus-5',
      stop_reason: 'end_turn',
      usage: usage(1),
      content: [results, { type: 'text', text: 'Environ 250 €', citations: [cite('https://c.be')] }]
    }
    const { client, create } = clientCreating(paused, done)
    const provider = new ClaudeProvider({ apiKey: () => 'k', model: () => 'claude-opus-5', createClient: () => client })
    const result = await provider.research(researchRequest)
    expect(create).toHaveBeenCalledTimes(2)
    const second = create.mock.calls[1]?.[0] as { messages: { role: string }[] }
    expect(second.messages.map((message) => message.role)).toEqual(['user', 'assistant'])
    expect(result).toMatchObject({ text: 'Environ 250 €', usage: { webSearches: 2, inputTokens: 10_000 } })
  })
})
