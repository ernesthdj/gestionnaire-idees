import { describe, expect, it } from 'vitest'
import { ollamaGuidance } from '../../../src/main/ipc/aiHandlers'

describe('ollamaGuidance', () => {
  it('should_return_no_steps_when_ollama_is_ready', () => {
    expect(ollamaGuidance({ up: true, model: 'qwen3.5:9b' }, 'qwen3.5:9b')).toEqual([])
  })

  it('should_return_three_steps_when_service_is_not_running', () => {
    const steps = ollamaGuidance({ up: false, problem: 'not_running' }, 'qwen3.5:9b')
    expect(steps).toHaveLength(3)
    expect(steps[0]).toMatch(/ollama\.com/)
    expect(steps[1]).toContain('ollama pull qwen3.5:9b')
    expect(steps[2]).toMatch(/Revérifier/)
  })

  it('should_return_download_and_recheck_steps_when_model_is_missing', () => {
    const steps = ollamaGuidance({ up: false, problem: 'model_missing' }, 'llama3.1:8b')
    expect(steps).toHaveLength(2)
    expect(steps[0]).toContain('ollama pull llama3.1:8b')
  })
})
