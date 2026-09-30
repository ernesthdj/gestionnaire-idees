import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { IdeasCanvas } from '../../../src/renderer/src/canvas/IdeasCanvas'
import type { BlockView } from '../../../src/shared/ipc/canvas'
import type { WidgetView } from '../../../src/shared/ipc/widgets'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import { expectNoAxeViolations } from '../../support/axe'
import { canvasView } from '../../fixtures/ui/canvas'
import { installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const BLOCK_ID = '00000000-0000-4000-8000-0000000000c2'
const V1 = '00000000-0000-4000-8000-0000000000d1'
const V2 = '00000000-0000-4000-8000-0000000000d2'

const block: BlockView = {
  id: BLOCK_ID,
  kind: 'widget',
  x: 0,
  y: 0,
  width: 520,
  height: 440,
  text: null,
  versionId: null,
  sourceBlockId: null
}

const version = (id: string, number: number, title: string) => ({
  id,
  number,
  title,
  summary: `Version ${number}`,
  model: 'claude-sonnet-5-5',
  createdAt: '2026-09-30T00:00:00.000Z'
})

const empty: WidgetView = { blockId: BLOCK_ID, request: null, current: null, versions: [], messages: [] }
const generated: WidgetView = {
  blockId: BLOCK_ID,
  request: null,
  current: { ...version(V2, 2, 'Compte à rebours'), html: '<main></main>', css: 'main{}', ts: 'const x: number = 1' },
  versions: [version(V1, 1, 'Minuteur'), version(V2, 2, 'Compte à rebours')],
  messages: [
    { id: 'm1', role: 'user', text: 'Un minuteur', versionNumber: null, failed: false },
    { id: 'm2', role: 'assistant', text: 'Un minuteur simple.', versionNumber: 1, failed: false },
    { id: 'm3', role: 'user', text: 'Compte à rebours plutôt', versionNumber: null, failed: false },
    { id: 'm4', role: 'assistant', text: 'Version 2', versionNumber: 2, failed: false }
  ]
}

function renderWidget(handlers: Parameters<typeof installFakeApi>[0]) {
  const api = installFakeApi({
    'canvas:get': () => ({ ...canvasView(), blocks: [block] }),
    'canvas:savePositions': () => ({ ok: true }),
    'app:getSettings': () => DEFAULT_APP_SETTINGS,
    ...handlers
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <IdeasCanvas />
    </QueryClientProvider>
  )
  return { api, ...result }
}

const widget = (): Promise<HTMLElement> => screen.findByRole('region', { name: /^Widget IA/ })

describe('widget IA sur la carte (spec 004 US3)', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => useUiStore.setState({ view: 'ideas', openRootId: null, bornId: null, toast: null }))

  it('should_send_the_request_to_claude_and_show_the_generated_widget_in_an_isolated_frame', async () => {
    const user = userEvent.setup()
    let finish = (): void => undefined
    const { api } = renderWidget({
      'widget:get': () => empty,
      'widget:prompt': () => new Promise((resolve) => (finish = () => resolve(generated)))
    })
    const frame = await widget()
    const field = within(frame).getByLabelText('Demande à Claude pour ce widget') as HTMLTextAreaElement
    await user.type(field, 'Un compte à rebours{Enter}')
    expect(api.invoke).toHaveBeenCalledWith('widget:prompt', { blockId: BLOCK_ID, text: 'Un compte à rebours' })
    // Pendant la génération : champ figé, indicateur et moteur annoncé.
    expect(field.readOnly).toBe(true)
    await act(async () =>
      api.emit('widget:thinking', { blockId: BLOCK_ID, engine: 'claude', model: 'claude-sonnet-5-5' })
    )
    expect(within(frame).getByText('Claude Sonnet 5.5')).toBeDefined()
    await act(async () => finish())

    const iframe = await within(await widget()).findByTitle('Compte à rebours')
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
    expect(iframe.getAttribute('src')).toMatch(
      new RegExp(`^gi-widget://widget/${BLOCK_ID}/${V2}\\?scheme=(light|dark)`)
    )
    expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(field.value).toBe('')
  })

  it('should_show_the_code_as_plain_text_never_as_markup', async () => {
    const user = userEvent.setup()
    renderWidget({ 'widget:get': () => generated })
    const frame = await widget()
    await user.click(await within(frame).findByRole('button', { name: 'Voir le code' }))
    expect(within(frame).getByRole('tabpanel').textContent).toBe('const x: number = 1')
    await user.click(within(frame).getByRole('tab', { name: 'HTML' }))
    expect(within(frame).getByRole('tabpanel').textContent).toBe('<main></main>')
    expect(frame.querySelector('main')).toBeNull()
  })

  it('should_restore_a_previous_version', async () => {
    const user = userEvent.setup()
    const { api } = renderWidget({
      'widget:get': () => generated,
      'widget:restore': () => ({ ...generated, current: { ...generated.current, ...version(V1, 1, 'Minuteur') } })
    })
    await user.selectOptions(await within(await widget()).findByLabelText('Version affichée'), 'v1')
    expect(api.invoke).toHaveBeenCalledWith('widget:restore', { blockId: BLOCK_ID, versionId: V1 })
  })

  it('should_explain_a_failure_in_the_chat', async () => {
    renderWidget({
      'widget:get': () => ({
        ...empty,
        messages: [
          { id: 'm1', role: 'user', text: 'Un minuteur', versionNumber: null, failed: false },
          { id: 'm2', role: 'assistant', text: 'Claude est indisponible', versionNumber: null, failed: true }
        ]
      })
    })
    expect((await within(await widget()).findByRole('status')).textContent).toBe('⚠ Claude est indisponible')
  })

  it('should_have_no_accessibility_violation', async () => {
    const { container } = renderWidget({ 'widget:get': () => generated })
    await within(await widget()).findByTitle('Compte à rebours')
    await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull())
    await expectNoAxeViolations(container)
  })

  describe('outil coché à l’éclosion (spec 006)', () => {
    const request = (state: 'queued' | 'running' | 'idle'): WidgetView => ({
      ...empty,
      request: { title: 'Tableau des dépenses', description: 'Additionne les achats prévus.', state }
    })

    it('should_show_that_claude_is_preparing_the_tool_and_lock_the_chat', async () => {
      renderWidget({ 'widget:get': () => request('running') })
      const node = await screen.findByRole('region', { name: 'Widget IA : Tableau des dépenses' })
      expect(await within(node).findByText('Claude prépare cet outil…')).toBeDefined()
      expect(within(node).getByText('Additionne les achats prévus.')).toBeDefined()
      expect((within(node).getByLabelText('Demande à Claude pour ce widget') as HTMLTextAreaElement).readOnly).toBe(
        true
      )
      expect(within(node).queryByRole('button', { name: 'Réessayer' })).toBeNull()
    })

    it('should_offer_to_retry_when_the_generation_did_not_succeed', async () => {
      const user = userEvent.setup()
      const { api } = renderWidget({ 'widget:get': () => request('idle'), 'widget:generate': () => generated })
      const node = await screen.findByRole('region', { name: 'Widget IA : Tableau des dépenses' })
      expect(await within(node).findByText('La fabrication de cet outil n’a pas abouti.')).toBeDefined()
      await user.click(within(node).getByRole('button', { name: 'Réessayer' }))
      await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('widget:generate', { blockId: BLOCK_ID }))
      expect(await screen.findByRole('region', { name: 'Widget IA : Compte à rebours' })).toBeDefined()
    })

    it('should_refresh_when_the_main_process_finishes_a_background_generation', async () => {
      let view = request('running')
      const { api } = renderWidget({ 'widget:get': () => view })
      await screen.findByText('Claude prépare cet outil…')
      view = generated
      act(() => api.emit('widget:thought', { type: 'widget:thought', blockId: BLOCK_ID }))
      expect(await screen.findByRole('region', { name: 'Widget IA : Compte à rebours' })).toBeDefined()
    })
  })
})
