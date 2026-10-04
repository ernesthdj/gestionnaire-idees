import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasService } from '../../../src/main/application/canvas/CanvasService'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { MapService, type MapChangedEvent } from '../../../src/main/application/mcp/MapService'
import { SelectionStore } from '../../../src/main/application/mcp/SelectionStore'
import { WidgetIoService } from '../../../src/main/application/widgets/WidgetIoService'
import { WidgetService } from '../../../src/main/application/widgets/WidgetService'
import { McpToolError } from '../../../src/main/domain/mcp/errors'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { HatchedRepository } from '../../../src/main/infrastructure/db/repositories/HatchedRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { LinkRepository } from '../../../src/main/infrastructure/db/repositories/LinkRepository'
import { MapLinkRepository } from '../../../src/main/infrastructure/db/repositories/MapLinkRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { WidgetIoRepository } from '../../../src/main/infrastructure/db/repositories/WidgetIoRepository'
import { WidgetRepository } from '../../../src/main/infrastructure/db/repositories/WidgetRepository'
import type { IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import type { ToolResult } from '../../../src/shared/mcp/protocol'
import { MCP_TOOLS, type McpToolName } from '../../../src/shared/mcp/tools'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('pont MCP — service de la carte', () => {
  let t: NeuronHarness
  let map: MapService
  let canvas: CanvasService
  let history: HistoryService
  let selection: SelectionStore
  let io: WidgetIoService
  let events: MapChangedEvent[]
  let ideaId: string

  /** Appel tel que le canal le fait : entrée validée par le schéma de l'outil, puis exécution. */
  const call = (tool: McpToolName, args: unknown): ToolResult => {
    const parsed = MCP_TOOLS[tool].input.parse(args)
    return map.handle(tool, parsed)
  }
  const failure = (tool: McpToolName, args: unknown): McpToolError => {
    try {
      call(tool, args)
    } catch (error) {
      if (error instanceof McpToolError) return error
      throw error
    }
    throw new Error('aucune erreur')
  }
  const view = (): IdeasCanvasView => canvas.get()

  beforeEach(async () => {
    t = createNeuronHarness()
    const db = t.handle.db
    const neuronRepository = new NeuronRepository(db)
    const blocks = new BlockRepository(db)
    const mapLinks = new MapLinkRepository(db)
    const widgetRepository = new WidgetRepository(db)
    const widgetIoRepository = new WidgetIoRepository(db)
    const hatched = new HatchedRepository(db)
    io = new WidgetIoService({
      repository: widgetIoRepository,
      widgets: widgetRepository,
      blocks,
      tree: (id) => (neuronRepository.root(id) === undefined ? undefined : t.neurons.getTree(id)),
      document: (id) => hatched.result(id)
    })
    const widgets = new WidgetService({ repository: widgetRepository, gateway: t.h.gateway, emit: () => undefined })
    canvas = new CanvasService({
      neurons: neuronRepository,
      links: new LinkRepository(db),
      blocks,
      steps: hatched,
      io,
      mapLinks
    })
    history = new HistoryService(new HistoryRepository(db))
    selection = new SelectionStore()
    events = []
    map = new MapService({
      canvas: () => canvas.get(),
      tree: (id) => (neuronRepository.root(id) === undefined ? undefined : t.neurons.getTree(id)),
      blocks,
      mapLinks,
      neurons: neuronRepository,
      selection,
      widgetFromCode: (blockId, code) => widgets.createFromCode(blockId, code),
      connectIdea: (blockId, rootId, parts) =>
        widgetIoRepository.insertInput({ blockId, sourceKind: 'idea', sourceId: rootId, parts }).id,
      emit: (event) => events.push(event)
    })
    ideaId = (await t.neurons.create({ text: 'Organiser le mariage de Léa', position: { x: 0, y: 0 } })).id
  })
  afterEach(() => t.dispose())

  const wedding = {
    cadre: { titre: 'Mariage' },
    noeuds: [
      { cle: 'presta', titre: 'Prestataires' },
      { cle: 'photo', titre: 'Photographe', parent: 'presta', texte: 'Réserver 6 mois avant' },
      { cle: 'traiteur', titre: 'Traiteur', parent: 'presta' },
      { cle: 'jour', titre: 'Jour J' },
      { cle: 'album', titre: 'Album photo', type: 'idee' as const, parent: 'photo' }
    ],
    liens: [{ de: 'jour', vers: 'photo', libelle: 'timing' }]
  }

  describe('lecture (US1)', () => {
    it('should_describe_the_real_map_state_with_counts_and_selection', () => {
      selection.set([ideaId])
      const { text } = call('etat', {})
      expect(text).toContain('1 brutes')
      expect(text).toContain(`Sélection (1)`)
      expect(text).toContain('Organiser le mariage de Léa')
    })

    it('should_say_there_is_no_selection_when_nothing_is_selected', () => {
      expect(call('selection_lire', {}).data).toEqual({ vide: true })
    })

    it('should_read_the_selection_with_direct_children_and_internal_links_only', () => {
      call('dessiner', wedding)
      const notes = view().blocks.filter((block) => block.kind === 'note')
      const presta = notes.find((block) => block.title === 'Prestataires')
      const jour = notes.find((block) => block.title === 'Jour J')
      selection.set([presta?.id ?? '', jour?.id ?? ''])
      const { text } = call('selection_lire', {})
      expect(text).toContain('Photographe')
      expect(text).toContain('Traiteur')
      expect(text).not.toContain('Organiser le mariage')
    })

    it('should_page_the_map_150_elements_at_a_time', () => {
      const noeuds = Array.from({ length: 200 }, (_, index) => ({ cle: `n${index}`, titre: `Note ${index}` }))
      call('dessiner', { noeuds })
      const first = call('carte_lire', {})
      expect(first.data).toEqual({ suivant: '150' })
      const second = call('carte_lire', { curseur: '150' })
      expect(second.data).toEqual({ suivant: null })
      expect(second.text).toContain('sur 201')
    })

    it('should_report_an_unknown_element_as_not_found', () => {
      expect(failure('noeud_lire', { id: '9f8b2a52-6d1c-4f3e-9a7b-2c4d5e6f7a8b' }).code).toBe('INTROUVABLE')
    })
  })

  describe('dessin (US2)', () => {
    it('should_draw_a_framed_batch_marked_by_claude_in_one_undoable_history_operation', () => {
      const result = call('dessiner', wedding)
      const after = view()
      const notes = after.blocks.filter((block) => block.kind === 'note')
      const frame = after.blocks.find((block) => block.kind === 'frame')
      expect(notes).toHaveLength(4)
      expect(frame?.title).toBe('Mariage')
      expect([...notes, frame].every((block) => block?.origin === 'claude')).toBe(true)
      expect(notes.every((note) => note.frameId === frame?.id)).toBe(true)
      expect(notes.find((note) => note.title === 'Photographe')?.parentBlockId).toBe(
        notes.find((note) => note.title === 'Prestataires')?.id
      )
      const album = after.ideas.find((idea) => idea.title === 'Album photo')
      expect(album).toMatchObject({ state: 'raw', origin: 'claude', pinned: true })
      // Le lien libellé et le lien note → idée (parent qui n'est pas une note).
      expect(after.mapLinks.map((link) => link.label).sort()).toEqual([null, 'timing'])

      const page = history.list()
      expect(page.items[0]).toMatchObject({ kind: 'mcp_write', actor: 'claude', undoable: true })
      expect(page.items[0]?.summary).toBe('Claude : 4 notes, 1 cadre, 1 idée, 2 liens')
      expect(events).toEqual([expect.objectContaining({ summary: 'Claude : 4 notes, 1 cadre, 1 idée, 2 liens' })])
      expect(result.data).toMatchObject({ lot: page.items[0]?.batchId })

      history.undo(page.items[0]?.batchId ?? '')
      const undone = view()
      expect(undone.blocks).toHaveLength(0)
      expect(undone.mapLinks).toHaveLength(0)
      expect(undone.ideas.map((idea) => idea.id)).toEqual([ideaId])
      expect(history.list().items[0]?.summary).toBe('Annulation — Claude : 4 notes, 1 cadre, 1 idée, 2 liens')
    })

    it('should_write_nothing_when_one_link_is_faulty', () => {
      const error = failure('dessiner', { noeuds: [{ cle: 'a', titre: 'A' }], liens: [{ de: 'a', vers: 'absent' }] })
      expect(error.code).toBe('LOT_INVALIDE')
      expect(error.message).toContain('liens[0].vers')
      expect(view().blocks).toHaveLength(0)
      expect(history.list().items).toHaveLength(0)
    })

    it('should_refuse_a_batch_over_200_nodes', () => {
      const noeuds = Array.from({ length: 201 }, (_, index) => ({ cle: `n${index}`, titre: `N${index}` }))
      expect(failure('dessiner', { noeuds }).code).toBe('LOT_TROP_GROS')
      expect(view().blocks).toHaveLength(0)
    })

    it('should_place_the_batch_without_overlapping_and_link_it_to_its_anchor', () => {
      call('dessiner', wedding)
      call('dessiner', { ancre: ideaId, noeuds: [{ cle: 'x', titre: 'Budget' }] })
      const blocks = view().blocks
      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          const a = blocks[i]
          const b = blocks[j]
          if (a === undefined || b === undefined || a.kind === 'frame' || b.kind === 'frame') continue
          const apart =
            Math.abs(a.x - b.x) >= (a.width + b.width) / 2 || Math.abs(a.y - b.y) >= (a.height + b.height) / 2
          expect(apart).toBe(true)
        }
      }
      const budget = blocks.find((block) => block.title === 'Budget')
      expect(view().mapLinks.some((link) => link.from.id === ideaId && link.to.id === budget?.id)).toBe(true)
    })
  })

  describe('modifier, relier, retirer (US3)', () => {
    it('should_modify_a_note_and_restore_it_on_undo', () => {
      call('dessiner', { noeuds: [{ cle: 'a', titre: 'Avant', texte: 'ancien' }] })
      const note = view().blocks[0]
      call('noeud_modifier', { id: note?.id, texte: 'nouveau' })
      expect(view().blocks[0]?.text).toBe('nouveau')
      history.undo(history.list().items[0]?.batchId ?? '')
      expect(view().blocks[0]?.text).toBe('ancien')
    })

    it('should_modify_an_idea_title_and_restore_it_on_undo', () => {
      call('noeud_modifier', { id: ideaId, titre: 'Mariage de Léa — juin' })
      expect(view().ideas[0]?.title).toBe('Mariage de Léa — juin')
      history.undo(history.list().items[0]?.batchId ?? '')
      expect(view().ideas[0]?.title).toBe('Organiser le mariage de Léa')
    })

    it('should_refuse_to_modify_a_widget', () => {
      call('widget_poser', { titre: 'Compte à rebours', html: '<p></p>', css: '', ts: 'const x = 1', resume: 'Compte' })
      const widget = view().blocks.find((block) => block.kind === 'widget')
      expect(failure('noeud_modifier', { id: widget?.id, titre: 'x' }).code).toBe('NON_MODIFIABLE')
    })

    it('should_link_two_elements_once_and_refuse_a_duplicate', () => {
      call('dessiner', { noeuds: [{ cle: 'a', titre: 'A' }] })
      const note = view().blocks[0]?.id ?? ''
      call('relier', { de: ideaId, vers: note, libelle: 'budget' })
      expect(failure('relier', { de: note, vers: ideaId }).code).toBe('DEJA_RELIES')
      expect(view().mapLinks).toHaveLength(1)
    })

    it('should_retire_a_frame_with_its_content_and_links_and_restore_everything_on_undo', () => {
      call('dessiner', wedding)
      const frame = view().blocks.find((block) => block.kind === 'frame')
      call('retirer', { ids: [frame?.id ?? ''] })
      const after = view()
      expect(after.blocks).toHaveLength(0)
      expect(after.mapLinks).toHaveLength(0)
      history.undo(history.list().items[0]?.batchId ?? '')
      expect(view().blocks).toHaveLength(5)
      expect(view().mapLinks).toHaveLength(2)
    })

    it('should_archive_an_idea_never_delete_it', () => {
      call('retirer', { ids: [ideaId] })
      expect(view().ideas).toHaveLength(0)
      history.undo(history.list().items[0]?.batchId ?? '')
      expect(view().ideas.map((idea) => idea.id)).toEqual([ideaId])
    })
  })

  describe('widget (US4)', () => {
    it('should_pose_a_widget_to_review_that_receives_nothing_before_approval', () => {
      const result = call('widget_poser', {
        titre: 'Épargne',
        html: '<main id="m"></main>',
        css: '',
        ts: 'gi.onInputs((inputs: unknown) => console.info(inputs))',
        resume: 'Calcule l’épargne',
        source: ideaId,
        parties: ['identity']
      })
      const blockId = (result.data as { id: string }).id
      const state = io.state(blockId)
      expect(state.approved).toBe(false)
      expect(state.inputs).toHaveLength(1)
      const widget = view().blocks.find((block) => block.id === blockId)
      expect(widget?.origin).toBe('claude')
      const versionId = widget?.versionId ?? ''
      expect(io.inputs({ blockId, versionId }).inputs).toEqual([])
      expect(history.list().items[0]).toMatchObject({ actor: 'claude', summary: 'Claude : 1 widget' })
    })

    it('should_create_nothing_when_the_code_is_refused', () => {
      expect(
        failure('widget_poser', { titre: 'Cassé', html: '', css: '', ts: 'const = ;', resume: 'Cassé' }).code
      ).toBe('CODE_REFUSE')
      expect(view().blocks).toHaveLength(0)
      expect(history.list().items).toHaveLength(0)
    })
  })
})
