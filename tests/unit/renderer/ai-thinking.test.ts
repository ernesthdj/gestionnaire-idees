import { describe, expect, it } from 'vitest'
import { workerLabel } from '../../../src/renderer/src/widgets/AiThinking'

describe('étiquette du moteur qui réfléchit', () => {
  it('should_name_the_claude_model_when_claude_works', () => {
    expect(workerLabel({ engine: 'claude', model: 'claude-opus-5-5' })).toBe('Claude Opus 5.5')
    expect(workerLabel({ engine: 'claude', model: 'claude-sonnet-5-5' })).toBe('Claude Sonnet 5.5')
    expect(workerLabel({ engine: 'claude', model: 'claude-haiku-4-5' })).toBe('Claude Haiku 4.5')
    expect(workerLabel({ engine: 'claude', model: 'claude-opus-5' })).toBe('Claude Opus 5')
  })

  it('should_name_the_local_model_when_ollama_works', () => {
    expect(workerLabel({ engine: 'ollama', model: 'qwen3.5:9b' })).toBe('Ollama · qwen3.5:9b')
  })

  it('should_fall_back_to_the_engine_name_when_the_model_is_unknown', () => {
    expect(workerLabel({ engine: 'ollama', model: '' })).toBe('Ollama')
    expect(workerLabel({ engine: 'claude', model: '' })).toBe('Claude')
    expect(workerLabel({ engine: 'claude', model: 'modele-maison' })).toBe('Claude · modele-maison')
  })
})
