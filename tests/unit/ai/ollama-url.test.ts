import { describe, expect, it } from 'vitest'
import { DEFAULT_OLLAMA_URL, resolveOllamaUrl } from '../../../src/main/infrastructure/ai/OllamaProvider'

describe('resolveOllamaUrl', () => {
  it('should_use_default_when_variable_is_absent', () => {
    expect(resolveOllamaUrl(undefined)).toEqual({ url: DEFAULT_OLLAMA_URL, rejected: false })
  })

  it('should_accept_loopback_address', () => {
    expect(resolveOllamaUrl('http://localhost:11500')).toEqual({ url: 'http://localhost:11500', rejected: false })
  })

  it('should_fall_back_to_default_when_address_is_not_local', () => {
    expect(resolveOllamaUrl('http://192.168.1.20:11434')).toEqual({ url: DEFAULT_OLLAMA_URL, rejected: true })
  })

  it('should_fall_back_to_default_when_address_is_malformed', () => {
    expect(resolveOllamaUrl('pas une url')).toEqual({ url: DEFAULT_OLLAMA_URL, rejected: true })
  })
})
