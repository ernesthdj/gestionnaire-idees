import { describe, expect, it } from 'vitest'
import { createLogger, teeSink, type LogRecord } from '../../../src/main/infrastructure/logging/logger'

function capture(): { records: LogRecord[]; sink: (record: LogRecord) => void } {
  const records: LogRecord[] = []
  return { records, sink: (record) => records.push(record) }
}

describe('logger', () => {
  it('should_keep_allowed_fields_when_logging', () => {
    const { records, sink } = capture()
    createLogger(sink).info('ai.call', { engine: 'claude', status: 'ok', durationMs: 120 })
    expect(records[0]).toMatchObject({
      level: 'info',
      event: 'ai.call',
      fields: { engine: 'claude', status: 'ok', durationMs: 120 }
    })
  })

  it('should_drop_sensitive_fields_when_they_are_not_whitelisted', () => {
    const { records, sink } = capture()
    createLogger(sink).info('ai.call', {
      engine: 'claude',
      text: 'acheter une télé',
      apiKey: 'sk-ant-xxx',
      amountCents: 125000,
      token: 'abc'
    })
    expect(records[0]?.fields).toEqual({ engine: 'claude' })
  })

  it('should_drop_non_primitive_values_when_logging', () => {
    const { records, sink } = capture()
    createLogger(sink).warn('ai.call', { status: { nested: 'secret' } as unknown as string })
    expect(records[0]?.fields).toEqual({})
  })

  it('should_truncate_long_strings_when_logging', () => {
    const { records, sink } = capture()
    createLogger(sink).error('ai.call', { code: 'x'.repeat(500) })
    expect(String(records[0]?.fields['code']).length).toBeLessThanOrEqual(64)
  })

  it('should_add_iso_timestamp_when_logging', () => {
    const { records, sink } = capture()
    createLogger(sink).info('app.start', {})
    expect(records[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('teeSink', () => {
  it('should_feed_every_sink_even_when_one_of_them_throws', () => {
    const { records, sink } = capture()
    const broken = (): void => {
      throw new Error('sonde en panne')
    }
    createLogger(teeSink(broken, sink)).warn('ipc.unexpected', { channel: 'canvas:get' })
    expect(records).toHaveLength(1)
  })
})
