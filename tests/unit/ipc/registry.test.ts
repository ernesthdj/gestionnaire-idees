import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AppError } from '../../../src/main/domain/errors'
import { createDispatcher, defineRoute, isTrustedSender } from '../../../src/main/ipc/registry'

const echo = defineRoute({
  channel: 'app:ping',
  input: z.object({ text: z.string().min(1).max(10) }).strict(),
  handler: async ({ text }) => ({ echo: text })
})

describe('createDispatcher', () => {
  const dispatch = createDispatcher([echo])

  it('should_return_data_when_payload_is_valid', async () => {
    await expect(dispatch('app:ping', { text: 'salut' })).resolves.toEqual({ success: true, data: { echo: 'salut' } })
  })

  it('should_return_validation_error_when_payload_is_invalid', async () => {
    const result = await dispatch('app:ping', { text: '' })
    expect(result).toMatchObject({ success: false, error: { code: 'VALIDATION' } })
  })

  it('should_reject_unknown_fields_when_schema_is_strict', async () => {
    const result = await dispatch('app:ping', { text: 'ok', extra: 1 })
    expect(result).toMatchObject({ success: false, error: { code: 'VALIDATION' } })
  })

  it('should_return_unknown_channel_when_route_is_missing', async () => {
    const result = await dispatch('app:inconnu', {})
    expect(result).toMatchObject({ success: false, error: { code: 'UNKNOWN_CHANNEL' } })
  })

  it('should_expose_code_and_message_when_handler_throws_app_error', async () => {
    const failing = createDispatcher([
      defineRoute({
        channel: 'app:ping',
        input: z.undefined(),
        handler: async () => {
          throw new AppError('NOT_FOUND', 'Neurone introuvable')
        }
      })
    ])
    await expect(failing('app:ping', undefined)).resolves.toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Neurone introuvable' }
    })
  })

  it('should_hide_internal_details_when_handler_throws_unexpected_error', async () => {
    const failing = createDispatcher([
      defineRoute({
        channel: 'app:ping',
        input: z.undefined(),
        handler: async () => {
          throw new Error('SQLITE_ERROR: secret path C:\\Users\\x')
        }
      })
    ])
    const result = await failing('app:ping', undefined)
    expect(result).toEqual({ success: false, error: { code: 'INTERNAL', message: 'Erreur interne' } })
  })

  it('should_throw_when_two_routes_share_a_channel', () => {
    expect(() => createDispatcher([echo, echo])).toThrow(/dupliqué/)
  })
})

describe('isTrustedSender', () => {
  const app = 'file:///C:/app/out/renderer/'

  it('should_accept_app_renderer_file_when_packaged', () => {
    expect(isTrustedSender('file:///C:/app/out/renderer/index.html', undefined, app)).toBe(true)
  })

  it('should_reject_other_local_file_when_packaged', () => {
    expect(isTrustedSender('file:///C:/Users/x/Downloads/piege.html', undefined, app)).toBe(false)
  })

  it('should_accept_dev_server_url_when_in_development', () => {
    expect(isTrustedSender('http://localhost:5173/', 'http://localhost:5173', app)).toBe(true)
  })

  it('should_reject_external_url_when_sender_is_remote', () => {
    expect(isTrustedSender('https://example.com/', 'http://localhost:5173', app)).toBe(false)
  })

  it('should_reject_missing_frame_url', () => {
    expect(isTrustedSender(undefined, undefined, app)).toBe(false)
  })
})
