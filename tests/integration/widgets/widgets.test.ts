import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WidgetService, type WidgetEvent } from '../../../src/main/application/widgets/WidgetService'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { WidgetRepository } from '../../../src/main/infrastructure/db/repositories/WidgetRepository'
import { createGatewayHarness, TEST_ROUTING, type GatewayHarness } from '../../support/gateway'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

const widget = (patch: Record<string, string> = {}) => ({
  raw: {
    title: 'Compte à rebours',
    html: '<main id="app"><output id="left"></output></main>',
    css: 'main { padding: 8px; }',
    ts: 'const left: HTMLOutputElement | null = document.querySelector("#left")\nif (left) left.value = "3 jours"',
    summary: 'Un compte à rebours jusqu’au mariage.',
    ...patch
  }
})

describe('widgets générés par Claude (spec 004 US3)', () => {
  let t: NeuronHarness
  let h: GatewayHarness
  let widgets: WidgetService
  let repository: WidgetRepository
  let blockId: string
  const events: WidgetEvent[] = []

  beforeEach(() => {
    t = createNeuronHarness()
    h = createGatewayHarness({
      config: () => ({
        // Même si la table de routage envoie les widgets en local, ils restent sur Claude.
        routing: { ...TEST_ROUTING, widget: 'ollama' },
        allowClaudeFallback: false,
        claudeModelFor: (kind) => (kind === 'widget' ? 'claude-sonnet-5-5' : undefined)
      })
    })
    repository = new WidgetRepository(t.handle.db)
    events.length = 0
    widgets = new WidgetService({ repository, gateway: h.gateway, emit: (event) => events.push(event) })
    blockId = new BlockRepository(t.handle.db).insert({
      kind: 'widget',
      x: 0,
      y: 0,
      width: 520,
      height: 440,
      text: null
    }).id
  })
  afterEach(() => t.dispose())

  it('should_generate_a_first_version_on_claude_with_the_widget_model_and_transpile_it', async () => {
    h.claude.enqueue(widget())
    const view = await widgets.prompt({ blockId, text: 'Un compte à rebours jusqu’au 12 juin' })
    expect(h.ollama.requests).toHaveLength(0)
    expect(h.claude.requests[0]?.model).toBe('claude-sonnet-5-5')
    expect(view.current).toMatchObject({ number: 1, title: 'Compte à rebours' })
    expect(view.messages.map((message) => [message.role, message.versionNumber, message.failed])).toEqual([
      ['user', null, false],
      ['assistant', 1, false]
    ])
    const stored = repository.version(blockId, view.current?.id ?? '')
    expect(stored?.js).not.toContain('HTMLOutputElement')
    expect(stored?.js).toContain('left.value = "3 jours"')
    expect(events.map((event) => event.type)).toEqual(['widget:thinking', 'widget:thinking', 'widget:thought'])
    expect(events[1]).toMatchObject({ engine: 'claude', model: 'claude-sonnet-5-5' })
  })

  it('should_send_the_current_code_untouched_but_the_request_anonymized_when_evolving', async () => {
    h.claude.enqueue(widget(), widget({ title: 'Compte à rebours 2', summary: 'Ajout d’un graphique.' }))
    await widgets.prompt({ blockId, text: 'Un compte à rebours' })
    const view = await widgets.prompt({ blockId, text: 'Ajoute un graphique pour Marc' })
    const sent = h.claude.requests[1]?.user ?? ''
    // Le code (sortie de Claude) repart tel quel : l'anonymiseur l'aurait abîmé.
    expect(sent).toContain('const left: HTMLOutputElement | null')
    expect(sent).toContain('Code actuel du widget « Compte à rebours » (version 1)')
    expect(h.anonymized.at(-1)).toContain('Ajoute un graphique pour Marc')
    expect(h.anonymized.at(-1)).not.toContain('HTMLOutputElement')
    expect(view.current?.number).toBe(2)
    expect(view.versions.map((version) => version.number)).toEqual([1, 2])
  })

  it('should_keep_the_previous_version_and_explain_when_the_typescript_is_invalid', async () => {
    h.claude.enqueue(widget(), widget({ ts: 'const = ;' }))
    await widgets.prompt({ blockId, text: 'Un compte à rebours' })
    const view = await widgets.prompt({ blockId, text: 'Casse tout' })
    expect(view.current?.number).toBe(1)
    expect(view.messages.at(-1)).toMatchObject({ role: 'assistant', failed: true, versionNumber: null })
    expect(view.messages.at(-1)?.text).toMatch(/invalide.*La version précédente reste affichée/)
  })

  it('should_refuse_an_oversized_widget_without_creating_a_version', async () => {
    h.claude.enqueue(widget({ html: 'x'.repeat(100_001) }), widget({ html: 'x'.repeat(100_001) }))
    const view = await widgets.prompt({ blockId, text: 'Un énorme widget' })
    expect(view.current).toBeNull()
    expect(view.messages.at(-1)).toMatchObject({ failed: true })
  })

  it('should_never_fall_back_to_the_local_model_when_claude_is_down', async () => {
    h.claude.setAvailable(false)
    const view = await widgets.prompt({ blockId, text: 'Un compte à rebours' })
    expect(h.ollama.requests).toHaveLength(0)
    expect(view.messages.at(-1)).toMatchObject({ failed: true, text: 'Claude est indisponible' })
  })

  it('should_restore_a_previous_version_without_deleting_anything', async () => {
    h.claude.enqueue(widget(), widget({ title: 'V2' }))
    const first = await widgets.prompt({ blockId, text: 'A' })
    await widgets.prompt({ blockId, text: 'B' })
    const restored = widgets.restore({ blockId, versionId: first.current?.id ?? '' })
    expect(restored.current?.number).toBe(1)
    expect(restored.versions).toHaveLength(2)
  })

  it('should_refuse_a_deleted_or_unknown_widget', async () => {
    new BlockRepository(t.handle.db).softDelete(blockId)
    await expect(widgets.prompt({ blockId, text: 'A' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(() => widgets.get(blockId)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
  })
})
