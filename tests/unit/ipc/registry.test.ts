import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AppError } from '../../../src/main/domain/errors'
import { createDispatcher, defineRoute, senderPage } from '../../../src/main/ipc/registry'

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

describe('senderPage', () => {
  const app = 'file:///C:/app/out/renderer/'
  const dev = 'http://localhost:5173'

  it.each([
    ['file:///C:/app/out/renderer/index.html', undefined, 'main'],
    ['file:///C:/app/out/renderer/capture.html', undefined, 'capture'],
    ['http://localhost:5173/', dev, 'main'],
    ['http://localhost:5173/capture.html?x=1', dev, 'capture']
  ])('should_identify_%s_as_an_app_page', (frameUrl, devUrl, page) => {
    expect(senderPage(frameUrl, devUrl, app)).toBe(page)
  })

  it.each([
    ['file:///C:/Users/x/Downloads/piege.html', undefined, 'autre fichier local'],
    ['file:///C:/app/out/renderer/autre.html', undefined, 'page inconnue du dossier renderer'],
    ['https://example.com/', dev, 'site distant'],
    ['http://localhost:51730/', dev, 'port voisin du serveur de dev'],
    ['http://localhost:5173/', undefined, 'serveur de dev hors développement'],
    [undefined, undefined, 'cadre sans URL'],
    ['pas une url', undefined, 'URL illisible']
  ] as const)('should_reject_%s_when_%s', (frameUrl, devUrl, reason) => {
    expect(senderPage(frameUrl, devUrl, app), reason).toBeNull()
  })
})

describe('mesure des appels de canal (spec 019)', () => {
  it('should_report_duration_and_outcome_without_payload_when_a_route_runs', async () => {
    const calls: unknown[][] = []
    const failing = defineRoute({
      channel: 'app:fail',
      input: z.object({}).strict(),
      handler: async () => {
        throw new AppError('NOPE', 'non')
      }
    })
    const dispatch = createDispatcher([echo, failing], undefined, (...args) => calls.push(args))
    await dispatch('app:ping', { text: 'secret' })
    await dispatch('app:fail', {})
    await dispatch('app:unknown', {})
    expect(calls).toEqual([
      ['app:ping', expect.any(Number), true],
      ['app:fail', expect.any(Number), false]
    ])
    expect(JSON.stringify(calls)).not.toContain('secret')
  })
})
