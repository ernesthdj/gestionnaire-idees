import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasService } from '../../../src/main/application/canvas/CanvasService'
import { ConversationService } from '../../../src/main/application/conversation/ConversationService'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { NeuronTools } from '../../../src/main/application/mcp/NeuronTools'
import { StructureService } from '../../../src/main/application/structure/StructureService'
import { McpToolError } from '../../../src/main/domain/mcp/errors'
import type { SpawnOptions } from '../../../src/main/infrastructure/claude/CliConversation'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { ConversationRepository } from '../../../src/main/infrastructure/db/repositories/ConversationRepository'
import { ElementRepository } from '../../../src/main/infrastructure/db/repositories/ElementRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { MapLinkRepository } from '../../../src/main/infrastructure/db/repositories/MapLinkRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import type { IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import { FicheEcrireInput, StructureDessinerInput } from '../../../src/shared/mcp/tools'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('carte de structure d’un projet (spec 009)', () => {
  let t: NeuronHarness
  let structure: StructureService
  let canvas: CanvasService
  let history: HistoryService
  let conversations: ConversationRepository
  let elements: ElementRepository
  let projet: string
  let autre: string
  let changed: string[]

  const map = {
    elements: [
      { cle: 'module:main', type: 'module', titre: 'Processus principal', resume: 'Services et base' },
      {
        cle: 'composant:conversation',
        type: 'composant',
        titre: 'ConversationService',
        parent: 'module:main',
        chemins: ['src/main/application/conversation/ConversationService.ts']
      },
      { cle: 'module:renderer', type: 'module', titre: 'Interface' },
      { cle: 'fonctionnalite:chat', type: 'fonctionnalite', titre: 'Chat des neurones', statut: 'en_cours' }
    ],
    liens: [{ de: 'module:renderer', vers: 'module:main', relation: 'appelle', libelle: 'IPC' }]
  }
  const draw = (args: unknown, neuronId: string | null = projet) =>
    structure.draw(StructureDessinerInput.parse(args), { neuronId })
  const view = (): IdeasCanvasView => canvas.get()

  beforeEach(async () => {
    t = createNeuronHarness()
    const db = t.handle.db
    conversations = new ConversationRepository(db)
    elements = new ElementRepository(db)
    const neuronRepository = new NeuronRepository(db)
    const links = new MapLinkRepository(db)
    changed = []
    structure = new StructureService({
      elements,
      links,
      genesisOf: (id) => {
        const neuron = conversations.neuron(id)
        if (neuron === undefined) return undefined
        return neuron.kind === 'root' ? neuron.id : (neuron.genesisId ?? undefined)
      },
      genesisTitle: (id) => neuronRepository.root(id)?.title,
      emit: (event) => changed.push(event.summary)
    })
    canvas = new CanvasService({
      neurons: neuronRepository,
      blocks: new BlockRepository(db),
      io: { links: () => [] },
      mapLinks: links,
      elements
    })
    history = new HistoryService(new HistoryRepository(db))
    projet = (await t.neurons.create({ text: 'Brainstormer' })).id
    autre = (await t.neurons.create({ text: 'Autre projet' })).id
  })
  afterEach(() => t.dispose())

  it('should_draw_typed_elements_around_their_genesis_with_typed_links', () => {
    draw(map)
    const { elements: drawn, mapLinks } = view()
    expect(drawn.map((element) => [element.key, element.type])).toEqual([
      ['module:main', 'module'],
      ['composant:conversation', 'composant'],
      ['module:renderer', 'module'],
      ['fonctionnalite:chat', 'fonctionnalite']
    ])
    const main = drawn.find((element) => element.key === 'module:main')
    // Niveau 1 visible, ses propres enfants repliés.
    expect(main).toMatchObject({ parentId: projet, childCount: 1, summary: 'Services et base', collapsed: true })
    expect(drawn.find((element) => element.key === 'composant:conversation')).toMatchObject({
      parentId: main?.id,
      collapsed: true,
      paths: ['src/main/application/conversation/ConversationService.ts']
    })
    expect(mapLinks).toEqual([expect.objectContaining({ relation: 'appelle', label: 'IPC' })])
    expect(changed).toEqual(['Claude : carte de structure — 4 créés, 1 lien'])
  })

  it('should_update_by_key_without_duplicates_and_keep_what_is_not_said', () => {
    draw(map)
    draw({ elements: [{ cle: 'fonctionnalite:chat', type: 'fonctionnalite', titre: 'Chat', statut: 'livree' }] })
    const drawn = view().elements
    expect(drawn).toHaveLength(4)
    expect(drawn.find((element) => element.key === 'fonctionnalite:chat')).toMatchObject({
      title: 'Chat',
      status: 'livree'
    })
    expect(view().mapLinks).toHaveLength(1)
  })

  it('should_keep_the_progression_order_given_by_claude_across_redraws_and_undo_it', () => {
    draw(map)
    const orderOf = (key: string): number | null | undefined =>
      view().elements.find((element) => element.key === key)?.order
    expect(orderOf('module:main')).toBeNull()
    draw({ elements: [{ cle: 'module:main', type: 'module', titre: 'Processus principal', ordre: 2 }] })
    const ordered = history.list().items[0]?.batchId ?? ''
    expect(orderOf('module:main')).toBe(2)
    // Redessiné sans ordre : le rang donné reste.
    draw({ elements: [{ cle: 'module:main', type: 'module', titre: 'Main' }] })
    const renamed = history.list().items[0]?.batchId ?? ''
    expect(orderOf('module:main')).toBe(2)
    // Annulations dans l'ordre : le dernier dessin (titre), puis celui qui a donné l'ordre.
    history.undo(renamed)
    expect(orderOf('module:main')).toBe(2)
    history.undo(ordered)
    expect(orderOf('module:main')).toBeNull()
    expect(() => draw({ elements: [{ cle: 'module:x', type: 'module', titre: 'X', ordre: 0 }] })).toThrow()
  })

  it('should_remove_absent_elements_only_when_asked_and_undo_everything_in_one_go', () => {
    draw(map)
    draw({ elements: [{ cle: 'module:main', type: 'module', titre: 'main' }], retirer_absents: true })
    expect(view().elements.map((element) => element.key)).toEqual(['module:main'])
    expect(view().mapLinks).toHaveLength(0)
    history.undo(history.list().items[0]?.batchId ?? '')
    expect(view().elements).toHaveLength(4)
    expect(view().elements.find((element) => element.key === 'module:main')?.title).toBe('Processus principal')
    history.undo(history.list().items.find((item) => item.summary.includes('4 éléments'))?.batchId ?? '')
    expect(view().elements).toHaveLength(0)
  })

  it('should_refuse_to_draw_in_another_project_than_its_conversation', () => {
    expect(() => draw({ projet: autre, elements: [{ cle: 'a', type: 'module', titre: 'A' }] })).toThrow(McpToolError)
    draw(map)
    const element = view().elements[0]
    // Depuis la conversation d'un élément, le projet est celui de son genesis.
    expect(() => draw({ elements: [{ cle: 'b', type: 'module', titre: 'B' }] }, element?.id ?? null)).not.toThrow()
    expect(view().elements.find((row) => row.key === 'b')?.genesisId).toBe(projet)
  })

  it('should_read_the_map_as_a_tree_and_keep_the_collapsed_state', () => {
    draw(map)
    const main = view().elements.find((element) => element.key === 'module:main')
    expect(structure.read(undefined, { neuronId: projet }).text).toMatch(
      /- \[module\] module:main « Processus principal »\n {2}- \[composant\] composant:conversation/
    )
    structure.setCollapsed(main?.id ?? '', true)
    expect(view().elements.find((element) => element.key === 'module:main')?.collapsed).toBe(true)
  })

  it('should_let_an_element_write_its_sheet_and_its_project_sheet_but_not_another_project', () => {
    draw(map)
    const element = view().elements.find((row) => row.key === 'composant:conversation')
    const tools = new NeuronTools({
      conversations,
      insertAssessment: (input) => conversations.insertAssessment(input),
      onChanged: () => undefined
    })
    const caller = { neuronId: element?.id ?? null }
    tools.writeSheet(FicheEcrireInput.parse({ resume: 'Gère les sessions' }), caller)
    expect(view().elements.find((row) => row.id === element?.id)?.summary).toBe('Gère les sessions')
    expect(() => tools.writeSheet(FicheEcrireInput.parse({ id: projet, resume: 'Projet' }), caller)).not.toThrow()
    expect(() => tools.writeSheet(FicheEcrireInput.parse({ id: autre, resume: 'x' }), caller)).toThrow(/autre arbre/)
  })

  it('should_open_an_element_conversation_in_the_project_folder_with_its_context', async () => {
    draw(map)
    conversations.setProjectDir(projet, 'C:/projets/brainstormer', '5e550000-0000-4000-8000-000000000001')
    const element = view().elements.find((row) => row.key === 'composant:conversation')
    const spawned: { options: SpawnOptions; written: string[] }[] = []
    const service = new ConversationService({
      repository: conversations,
      spawn: (options) => {
        const entry = { options, written: [] as string[] }
        spawned.push(entry)
        return { write: (line) => entry.written.push(line), kill: () => undefined }
      },
      claudePath: async () => 'claude.exe',
      settings: () => ({ cwd: 'C:/ws', model: 'm', electronPath: 'e', relayPath: 'r', profileDir: 'p' }),
      frame: 'CADRE',
      emit: () => undefined,
      folderExists: () => true
    })
    expect(service.open(element?.id ?? '').folder).toBe('brainstormer')
    await service.send(element?.id ?? '', 'Explique ce composant')
    expect(spawned[0]?.options.cwd).toBe('C:/projets/brainstormer')
    const content = (JSON.parse(spawned[0]?.written[0] ?? '{}') as { message: { content: string } }).message.content
    expect(content).toContain('composant « ConversationService »')
    expect(content).toContain('projet › module « Processus principal » › ConversationService')
    expect(content).toContain('src/main/application/conversation/ConversationService.ts')
    await expect(service.linkFolder(element?.id ?? '')).rejects.toThrow(/genesis/)
    service.stopAll()
  })
})
