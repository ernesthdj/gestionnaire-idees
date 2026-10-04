import { randomUUID } from 'node:crypto'
import {
  BLOCK_DEFAULT_SIZES,
  type BlockView,
  type CanvasNeuronView,
  type IdeasCanvasView,
  type MapEnd
} from '@shared/ipc/canvas'
import type { TreeView } from '@shared/ipc/neurons'
import type { IdeaPart } from '@shared/ipc/widgetIo'
import type { ToolResult } from '@shared/mcp/protocol'
import {
  MCP_LIMITS,
  type DessinerInput,
  type McpToolName,
  type NoeudModifierInput,
  type RelierInput,
  type RetirerInput,
  type WidgetPoserInput
} from '@shared/mcp/tools'
import { AppError } from '../../domain/errors'
import { resolveBatch, type ExistingKind, type ResolvedRef } from '../../domain/mcp/batch'
import { McpToolError } from '../../domain/mcp/errors'
import { layoutBatch, NOTE_WIDTH, noteHeight, type LayoutItem, type Rect } from '../../domain/mcp/layout'
import type { BlockRepository } from '../../infrastructure/db/repositories/BlockRepository'
import type { ChangeEntry } from '../../infrastructure/db/repositories/changeLog'
import type { MapLinkRepository } from '../../infrastructure/db/repositories/MapLinkRepository'
import type { NeuronRepository } from '../../infrastructure/db/repositories/NeuronRepository'
import type { SelectionStore } from './SelectionStore'

/** Écriture de Claude appliquée : la fenêtre principale rafraîchit la carte et propose « Annuler » (FR-014). */
export interface MapChangedEvent {
  readonly batchId: string
  readonly summary: string
  readonly count: number
}

export interface MapServiceDeps {
  /** Carte telle que l'interface la voit (idées, blocs, liens). */
  readonly canvas: () => IdeasCanvasView
  /** Arbre d'une idée (sous-neurones) ; `undefined` si elle n'existe plus. */
  readonly tree: (rootId: string) => TreeView | undefined
  readonly blocks: Pick<BlockRepository, 'get' | 'insert' | 'softDelete' | 'updateText' | 'log' | 'transaction'>
  readonly mapLinks: Pick<MapLinkRepository, 'insert' | 'between' | 'touching' | 'softDelete'>
  readonly neurons: Pick<NeuronRepository, 'insertRoot' | 'updateRoot'>
  readonly selection: SelectionStore
  /** Crée la version d'un widget à partir du code fourni (validation et transpilation de la spec 004). */
  readonly widgetFromCode: (blockId: string, code: WidgetPoserInput) => void
  /** Branche une idée sur un widget avec les parties lues (spec 005) ; renvoie l'identifiant du branchement. */
  readonly connectIdea: (blockId: string, rootId: string, parts: readonly IdeaPart[]) => string
  /** Classement local d'une idée posée par Claude, après la transaction. */
  readonly categorize?: (rootId: string) => void
  readonly emit: (event: MapChangedEvent) => void
}

const IDEA_SIZE = 120
const ELEMENT_KINDS = {
  empty: 'bloc',
  label: 'note',
  widget: 'widget',
  result: 'resultat',
  note: 'note',
  frame: 'cadre'
} as const
const IDEA_STATES = { raw: 'brute', developing: 'en développement', hatched: 'éclose', archived: 'archivée' } as const

type Element =
  { readonly kind: 'idea'; readonly idea: CanvasNeuronView } | { readonly kind: 'block'; readonly block: BlockView }

interface Universe {
  readonly view: IdeasCanvasView
  readonly byId: ReadonlyMap<string, Element>
}

const shorten = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`)

/** Borne une réponse texte ; une troncature est toujours signalée (FR-005). */
function bounded(text: string): string {
  if (text.length <= MCP_LIMITS.responseMaxChars) return text
  return `${text.slice(0, MCP_LIMITS.responseMaxChars - 120)}\n… [réponse tronquée : lis les éléments un par un avec noeud_lire]`
}

/**
 * Carte vue et écrite par Claude Code (spec 007) : lectures compactes, et écritures directes — chacune une opération
 * d'Historique « par Claude », annulable, tout ou rien. Le placement est fait ici, jamais par Claude.
 */
export class MapService {
  constructor(private readonly deps: MapServiceDeps) {}

  handle(tool: McpToolName, args: unknown): ToolResult {
    switch (tool) {
      case 'etat':
        return this.state()
      case 'carte_lire':
        return this.readMap((args as { curseur?: string }).curseur)
      case 'selection_lire':
        return this.readSelection()
      case 'noeud_lire': {
        const input = args as { id: string; profondeur?: number }
        return this.readNode(input.id, input.profondeur ?? 1)
      }
      case 'dessiner':
        return this.draw(args as DessinerInput)
      case 'noeud_modifier':
        return this.modify(args as NoeudModifierInput)
      case 'relier':
        return this.link(args as RelierInput)
      case 'retirer':
        return this.retire(args as RetirerInput)
      case 'widget_poser':
        return this.poseWidget(args as WidgetPoserInput)
    }
  }

  // ── Lectures ─────────────────────────────────────────────────────────────────────────────────────────────────

  private universe(): Universe {
    const view = this.deps.canvas()
    const byId = new Map<string, Element>()
    for (const idea of view.ideas) byId.set(idea.id, { kind: 'idea', idea })
    for (const block of view.blocks) byId.set(block.id, { kind: 'block', block })
    return { view, byId }
  }

  private line(element: Element): string {
    if (element.kind === 'idea') {
      const { idea } = element
      const by = idea.origin === 'claude' ? ', par Claude' : ''
      return `- [idee] ${idea.id} « ${shorten(idea.title, 120)} » (${IDEA_STATES[idea.state]}${by})`
    }
    const { block } = element
    const name = block.title ?? (block.kind === 'label' ? shorten(block.text ?? '', 80) : '')
    const extra = [
      block.parentBlockId === null ? null : `parent ${block.parentBlockId}`,
      block.frameId === null ? null : `cadre ${block.frameId}`,
      block.origin === 'claude' ? 'par Claude' : null
    ].filter((part) => part !== null)
    return `- [${ELEMENT_KINDS[block.kind]}] ${block.id}${name === '' ? '' : ` « ${shorten(name, 120)} »`}${extra.length === 0 ? '' : ` (${extra.join(', ')})`}`
  }

  private linkLines(view: IdeasCanvasView, within?: ReadonlySet<string>): string[] {
    const keep = (a: string, b: string): boolean => within === undefined || (within.has(a) && within.has(b))
    return [
      ...view.mapLinks
        .filter((link) => keep(link.from.id, link.to.id))
        .map((link) => `- ${link.from.id} → ${link.to.id}${link.label === null ? '' : ` « ${link.label} »`}`),
      ...view.links
        .filter((link) => link.status === 'accepted' && keep(link.a.id, link.b.id))
        .map((link) => `- ${link.a.id} ↔ ${link.b.id} « ${link.label} » (lien entre idées)`)
    ]
  }

  private state(): ToolResult {
    const { view, byId } = this.universe()
    const count = (kind: BlockView['kind']): number => view.blocks.filter((block) => block.kind === kind).length
    const selected = this.deps.selection.get().flatMap((id) => {
      const element = byId.get(id)
      return element === undefined ? [] : [this.line(element)]
    })
    const recent = [
      ...[...view.ideas]
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
        .slice(-5)
        .map((idea) => this.line({ kind: 'idea', idea })),
      ...view.blocks.slice(-5).map((block) => this.line({ kind: 'block', block }))
    ]
    const text = [
      'Brainstormer — carte de mentalyas',
      `Idées : ${view.counts.raw} brutes, ${view.counts.developing} en développement, ${view.counts.hatched} écloses · ` +
        `Notes : ${count('note') + count('label')} · Cadres : ${count('frame')} · Widgets : ${count('widget')}`,
      selected.length === 0 ? 'Sélection : aucune' : `Sélection (${selected.length}) :\n${selected.join('\n')}`,
      recent.length === 0 ? 'Carte vide.' : `Éléments récents :\n${recent.join('\n')}`,
      'Lis la carte avec carte_lire, un élément avec noeud_lire ; dessine avec dessiner.'
    ].join('\n\n')
    return { text: bounded(text) }
  }

  private readMap(cursor: string | undefined): ToolResult {
    const { view } = this.universe()
    const elements: Element[] = [
      ...view.blocks.filter((block) => block.kind === 'frame').map((block): Element => ({ kind: 'block', block })),
      ...view.ideas.map((idea): Element => ({ kind: 'idea', idea })),
      ...view.blocks.filter((block) => block.kind !== 'frame').map((block): Element => ({ kind: 'block', block }))
    ]
    const start = cursor !== undefined && /^\d+$/.test(cursor) ? Number(cursor) : 0
    const page = elements.slice(start, start + MCP_LIMITS.pageSize)
    const ids = new Set(page.map((element) => (element.kind === 'idea' ? element.idea.id : element.block.id)))
    const next = start + MCP_LIMITS.pageSize < elements.length ? String(start + MCP_LIMITS.pageSize) : null
    const links = this.linkLines(view, ids)
    const text = [
      `Carte : éléments ${elements.length === 0 ? 0 : start + 1} à ${start + page.length} sur ${elements.length}`,
      page.map((element) => this.line(element)).join('\n'),
      links.length === 0 ? null : `Liens :\n${links.join('\n')}`,
      next === null ? null : `Suite : carte_lire avec curseur « ${next} »`
    ]
      .filter((part) => part !== null && part !== '')
      .join('\n\n')
    return { text: bounded(text), data: { suivant: next } }
  }

  private describe(element: Element, depth: number, universe: Universe): string {
    if (element.kind === 'idea') {
      const { idea } = element
      const parts = [this.line(element), idea.content === null ? null : `Contenu : ${idea.content}`]
      const tree = depth === 0 ? undefined : this.deps.tree(idea.id)
      if (tree !== undefined) {
        const lines = tree.neurons
          .filter((neuron) => neuron.depth <= depth)
          .map(
            (neuron) =>
              `${'  '.repeat(Math.max(0, neuron.depth - 1))}- ${neuron.id} « ${shorten(neuron.title, 120)} »${neuron.content === null ? '' : ` : ${shorten(neuron.content, 400)}`}`
          )
        if (lines.length > 0) parts.push(`Sous-neurones (développement de l'idée) :\n${lines.join('\n')}`)
      }
      return parts.filter((part) => part !== null).join('\n')
    }
    const { block } = element
    const parts: string[] = [this.line(element)]
    if (block.text !== null && block.text !== '') parts.push(`Texte : ${block.text}`)
    if (depth > 0) {
      const inside = (id: string, level: number): string[] =>
        universe.view.blocks
          .filter(
            (child) => child.parentBlockId === id || (block.kind === 'frame' && level === 1 && child.frameId === id)
          )
          .flatMap((child) => [
            `${'  '.repeat(level - 1)}${this.line({ kind: 'block', block: child })}`,
            ...(level < depth ? inside(child.id, level + 1) : [])
          ])
      const lines = inside(block.id, 1)
      if (lines.length > 0)
        parts.push(`${block.kind === 'frame' ? 'Contenu du cadre' : 'Enfants'} :\n${lines.join('\n')}`)
    }
    return parts.join('\n')
  }

  private readSelection(): ToolResult {
    const universe = this.universe()
    const elements = this.deps.selection.get().flatMap((id) => {
      const element = universe.byId.get(id)
      return element === undefined ? [] : [element]
    })
    if (elements.length === 0) {
      return { text: 'Aucune sélection : mentalyas n’a rien sélectionné sur la carte.', data: { vide: true } }
    }
    const ids = new Set(elements.map((element) => (element.kind === 'idea' ? element.idea.id : element.block.id)))
    const links = this.linkLines(universe.view, ids)
    const text = [
      `Sélection de mentalyas (${elements.length}) :`,
      ...elements.map((element) => this.describe(element, 1, universe)),
      links.length === 0 ? null : `Liens entre les éléments sélectionnés :\n${links.join('\n')}`
    ]
      .filter((part) => part !== null)
      .join('\n\n')
    return { text: bounded(text), data: { vide: false } }
  }

  private readNode(id: string, depth: number): ToolResult {
    const universe = this.universe()
    const element = this.require(universe, id)
    const links = universe.view.mapLinks
      .filter((link) => link.from.id === id || link.to.id === id)
      .map((link) => `- ${link.from.id} → ${link.to.id}${link.label === null ? '' : ` « ${link.label} »`}`)
    const text = [this.describe(element, depth, universe), links.length === 0 ? null : `Liens :\n${links.join('\n')}`]
      .filter((part) => part !== null)
      .join('\n\n')
    return { text: bounded(text) }
  }

  private require(universe: Universe, id: string): Element {
    const element = universe.byId.get(id)
    if (element === undefined) throw new McpToolError('INTROUVABLE', `Élément ${id} introuvable (retiré ou annulé ?)`)
    return element
  }

  // ── Écritures ────────────────────────────────────────────────────────────────────────────────────────────────

  private draw(input: DessinerInput): ToolResult {
    const universe = this.universe()
    const existingKind = (id: string): ExistingKind | undefined => {
      const element = universe.byId.get(id)
      if (element === undefined) return undefined
      if (element.kind === 'idea') return 'idea'
      if (element.block.kind === 'note' || element.block.kind === 'label') return 'note'
      return element.block.kind === 'frame' ? 'frame' : 'other'
    }
    const resolved = resolveBatch(input, existingKind)
    if (!resolved.ok) throw new McpToolError(resolved.problem.code, resolved.problem.message)
    const anchor = input.ancre === undefined ? undefined : this.require(universe, input.ancre)
    const { nodes, links } = resolved.batch

    // Placement : l'arbre du lot (parents internes seulement), autour de ce qui existe déjà.
    const items: LayoutItem[] = nodes.map((node) => ({
      key: node.key,
      parent: node.parent?.kind === 'key' ? node.parent.key : null,
      width: node.type === 'idee' ? IDEA_SIZE : NOTE_WIDTH,
      height: node.type === 'idee' ? IDEA_SIZE : noteHeight(node.title, node.text)
    }))
    const anchorRect = anchor === undefined ? null : this.rectOf(anchor)
    const layout = layoutBatch({
      items,
      occupied: this.occupied(universe),
      ...(anchorRect === null ? {} : { anchor: anchorRect }),
      framed: input.cadre !== undefined
    })

    const batchId = randomUUID()
    const entries: ChangeEntry[] = []
    const ids = new Map<string, { readonly id: string; readonly end: MapEnd }>()
    const typeOf = new Map(nodes.map((node) => [node.key, node.type] as const))
    const { blocks, neurons, mapLinks } = this.deps
    const createdIdeas: string[] = []
    let linkCount = 0

    blocks.transaction(() => {
      let frameId: string | null = null
      if (input.cadre !== undefined && layout.frame !== null) {
        const frame = blocks.insert({
          kind: 'frame',
          ...layout.frame,
          text: null,
          title: input.cadre.titre,
          origin: 'claude'
        })
        frameId = frame.id
        entries.push({
          kind: 'mcp_write',
          entity: 'canvas_block',
          entityId: frame.id,
          before: null,
          after: { kind: 'frame' }
        })
      }
      for (const node of nodes) {
        const center = layout.centers.get(node.key) ?? { x: 0, y: 0 }
        if (node.type === 'idee') {
          const id = randomUUID()
          neurons.insertRoot({
            id,
            title: node.title.slice(0, 120),
            content: node.text,
            nature: 'reflection',
            natureSource: null,
            position: center,
            origin: 'claude',
            pinned: true
          })
          createdIdeas.push(id)
          ids.set(node.key, { id, end: { kind: 'idea', id } })
          entries.push({
            kind: 'mcp_write',
            entity: 'neuron',
            entityId: id,
            before: null,
            after: { state: 'raw', version: 0 }
          })
          continue
        }
        const parentNote = this.parentNote(node.parent, typeOf, ids)
        const block = blocks.insert({
          kind: 'note',
          x: center.x,
          y: center.y,
          width: NOTE_WIDTH,
          height: noteHeight(node.title, node.text),
          text: node.text,
          title: node.title,
          parentBlockId: parentNote,
          frameId:
            frameId ?? (node.parent?.kind === 'existing' && node.parent.existing === 'frame' ? node.parent.id : null),
          origin: 'claude'
        })
        ids.set(node.key, { id: block.id, end: { kind: 'block', id: block.id } })
        entries.push({
          kind: 'mcp_write',
          entity: 'canvas_block',
          entityId: block.id,
          before: null,
          after: { kind: 'note' }
        })
      }

      const endOf = (ref: ResolvedRef): MapEnd => {
        if (ref.kind === 'key') return (ids.get(ref.key) as { end: MapEnd }).end
        return { kind: ref.existing === 'idea' ? 'idea' : 'block', id: ref.id }
      }
      const addLink = (from: MapEnd, to: MapEnd, label: string | null): void => {
        if (from.id === to.id || mapLinks.between(from, to) !== undefined) return
        const link = mapLinks.insert({ from, to, label, origin: 'claude' })
        linkCount++
        entries.push({ kind: 'mcp_write', entity: 'map_link', entityId: link.id, before: null, after: { label } })
      }
      // Un parent qui n'est pas une note (idée, ou note sous une idée) se dessine par un lien.
      for (const node of nodes) {
        if (node.parent === null) continue
        const child = (ids.get(node.key) as { end: MapEnd }).end
        const isNoteTree = node.type === 'note' && this.parentNote(node.parent, typeOf, ids) !== null
        const inExistingFrame = node.parent.kind === 'existing' && node.parent.existing === 'frame'
        if (!isNoteTree && !inExistingFrame) addLink(endOf(node.parent), child, null)
      }
      for (const link of links) addLink(endOf(link.from), endOf(link.to), link.label)
      if (anchor !== undefined) {
        const anchorEnd: MapEnd =
          anchor.kind === 'idea' ? { kind: 'idea', id: anchor.idea.id } : { kind: 'block', id: anchor.block.id }
        const targets =
          frameId !== null
            ? [{ kind: 'block' as const, id: frameId }]
            : nodes.filter((node) => node.parent === null).map((node) => (ids.get(node.key) as { end: MapEnd }).end)
        for (const target of targets) addLink(anchorEnd, target, null)
      }
      blocks.log(batchId, entries, 'claude')
      if (frameId !== null) ids.set('cadre', { id: frameId, end: { kind: 'block', id: frameId } })
    })

    for (const id of createdIdeas) this.deps.categorize?.(id)
    const ideaCount = createdIdeas.length
    const noteCount = nodes.length - ideaCount
    const summary = summaryOf([
      [noteCount, 'note', 'notes'],
      [input.cadre === undefined ? 0 : 1, 'cadre', 'cadres'],
      [ideaCount, 'idée', 'idées'],
      [linkCount, 'lien', 'liens']
    ])
    this.deps.emit({ batchId, summary: `Claude : ${summary}`, count: entries.length })
    const idLines = [...ids].map(([key, value]) => `${key} = ${value.id}`)
    return {
      text: `Lot dessiné : ${summary} (annulable par mentalyas).\nIdentifiants :\n${idLines.join('\n')}`,
      data: { lot: batchId, ids: Object.fromEntries([...ids].map(([key, value]) => [key, value.id])) }
    }
  }

  /** Note parente d'une note : une clé du lot de type note, ou une note existante ; sinon `null`. */
  private parentNote(
    parent: ResolvedRef | null,
    typeOf: ReadonlyMap<string, 'note' | 'idee'>,
    ids: ReadonlyMap<string, { readonly id: string }>
  ): string | null {
    if (parent === null) return null
    if (parent.kind === 'key') return typeOf.get(parent.key) === 'note' ? (ids.get(parent.key)?.id ?? null) : null
    return parent.existing === 'note' ? parent.id : null
  }

  private rectOf(element: Element): Rect | null {
    if (element.kind === 'block') {
      const { block } = element
      return { x: block.x, y: block.y, width: block.width, height: block.height }
    }
    const position = element.idea.position
    return position === null ? null : { ...position, width: IDEA_SIZE + 40, height: IDEA_SIZE + 40 }
  }

  private occupied(universe: Universe): Rect[] {
    return [...universe.byId.values()].flatMap((element) => {
      const rect = this.rectOf(element)
      return rect === null ? [] : [rect]
    })
  }

  private modify(input: NoeudModifierInput): ToolResult {
    const universe = this.universe()
    const element = this.require(universe, input.id)
    const batchId = randomUUID()
    const { blocks, neurons } = this.deps
    if (element.kind === 'idea') {
      const { idea } = element
      const after = { title: (input.titre ?? idea.title).slice(0, 120), content: input.texte ?? idea.content }
      blocks.transaction(() => {
        neurons.updateRoot(idea.id, { title: after.title, content: after.content })
        blocks.log(
          batchId,
          [
            {
              kind: 'mcp_write',
              entity: 'neuron_text',
              entityId: idea.id,
              before: { title: idea.title, content: idea.content },
              after
            }
          ],
          'claude'
        )
      })
    } else {
      const { block } = element
      if (block.kind !== 'note' && block.kind !== 'frame' && block.kind !== 'label') {
        throw new McpToolError('NON_MODIFIABLE', `Un ${ELEMENT_KINDS[block.kind]} ne se modifie pas par le pont.`)
      }
      // Une note simple (sans titre) n'a qu'un texte : le titre demandé devient son texte.
      const after =
        block.kind === 'label'
          ? { title: null, text: input.texte ?? input.titre ?? block.text }
          : { title: input.titre ?? block.title, text: block.kind === 'frame' ? null : (input.texte ?? block.text) }
      blocks.transaction(() => {
        blocks.updateText(block.id, after)
        blocks.log(
          batchId,
          [
            {
              kind: 'mcp_write',
              entity: 'block_text',
              entityId: block.id,
              before: { title: block.title, text: block.text },
              after
            }
          ],
          'claude'
        )
      })
    }
    this.deps.emit({ batchId, summary: 'Claude : 1 modification', count: 1 })
    return { text: `Élément ${input.id} modifié (annulable par mentalyas).`, data: { lot: batchId } }
  }

  private link(input: RelierInput): ToolResult {
    const universe = this.universe()
    if (input.de === input.vers) throw new McpToolError('LOT_INVALIDE', 'Un lien relie deux éléments différents.')
    const end = (id: string): MapEnd => ({ kind: this.require(universe, id).kind === 'idea' ? 'idea' : 'block', id })
    const from = end(input.de)
    const to = end(input.vers)
    if (this.deps.mapLinks.between(from, to) !== undefined) {
      throw new McpToolError('DEJA_RELIES', 'Ces deux éléments sont déjà reliés.')
    }
    const batchId = randomUUID()
    const label = input.libelle === undefined || input.libelle === '' ? null : input.libelle
    let linkId = ''
    this.deps.blocks.transaction(() => {
      linkId = this.deps.mapLinks.insert({ from, to, label, origin: 'claude' }).id
      this.deps.blocks.log(
        batchId,
        [{ kind: 'mcp_write', entity: 'map_link', entityId: linkId, before: null, after: { label } }],
        'claude'
      )
    })
    this.deps.emit({ batchId, summary: 'Claude : 1 lien', count: 1 })
    return { text: `Lien créé : ${linkId} (annulable par mentalyas).`, data: { id: linkId, lot: batchId } }
  }

  private retire(input: RetirerInput): ToolResult {
    const universe = this.universe()
    const targets = new Map<string, Element>()
    const add = (element: Element): void => {
      const id = element.kind === 'idea' ? element.idea.id : element.block.id
      if (targets.has(id)) return
      targets.set(id, element)
      if (element.kind !== 'block') return
      // Un cadre emporte son contenu ; une note, sa descendance.
      for (const block of universe.view.blocks) {
        if (block.parentBlockId === id || (element.block.kind === 'frame' && block.frameId === id)) {
          add({ kind: 'block', block })
        }
      }
    }
    for (const id of input.ids) add(this.require(universe, id))

    const batchId = randomUUID()
    const entries: ChangeEntry[] = []
    const { blocks, neurons, mapLinks } = this.deps
    blocks.transaction(() => {
      for (const [id, element] of targets) {
        if (element.kind === 'idea') {
          neurons.updateRoot(id, { state: 'archived', archivedAt: new Date().toISOString() })
          entries.push({
            kind: 'mcp_write',
            entity: 'neuron',
            entityId: id,
            before: { state: element.idea.state, version: element.idea.version },
            after: null
          })
        } else {
          blocks.softDelete(id)
          entries.push({
            kind: 'mcp_write',
            entity: 'canvas_block',
            entityId: id,
            before: { kind: element.block.kind },
            after: null
          })
        }
      }
      const links = new Map([...targets.keys()].flatMap((id) => mapLinks.touching(id)).map((link) => [link.id, link]))
      for (const link of links.values()) {
        mapLinks.softDelete(link.id)
        entries.push({
          kind: 'mcp_write',
          entity: 'map_link',
          entityId: link.id,
          before: { label: link.label },
          after: null
        })
      }
      blocks.log(batchId, entries, 'claude')
    })
    this.deps.emit({
      batchId,
      summary: `Claude : ${summaryOf([[targets.size, 'retrait', 'retraits']])}`,
      count: entries.length
    })
    return {
      text: `${targets.size} élément${targets.size > 1 ? 's' : ''} retiré${targets.size > 1 ? 's' : ''} (restaurables par mentalyas).`,
      data: { lot: batchId, retires: targets.size }
    }
  }

  private poseWidget(input: WidgetPoserInput): ToolResult {
    const universe = this.universe()
    const source = input.source === undefined ? undefined : this.require(universe, input.source)
    if (source !== undefined && source.kind !== 'idea') {
      throw new McpToolError('LOT_INVALIDE', 'source : seule une idée peut être branchée sur un widget.')
    }
    const size = BLOCK_DEFAULT_SIZES.widget
    const anchor = source === undefined ? null : this.rectOf(source)
    const layout = layoutBatch({
      items: [{ key: 'widget', parent: null, ...size }],
      occupied: this.occupied(universe),
      framed: false,
      ...(anchor === null ? {} : { anchor })
    })
    const center = layout.centers.get('widget') ?? { x: 0, y: 0 }
    const batchId = randomUUID()
    let blockId = ''
    try {
      this.deps.blocks.transaction(() => {
        const block = this.deps.blocks.insert({ kind: 'widget', ...center, ...size, text: null, origin: 'claude' })
        blockId = block.id
        this.deps.widgetFromCode(block.id, input)
        const entries: ChangeEntry[] = [
          { kind: 'mcp_write', entity: 'canvas_block', entityId: block.id, before: null, after: { kind: 'widget' } }
        ]
        if (source !== undefined && source.kind === 'idea') {
          const inputId = this.deps.connectIdea(block.id, source.idea.id, input.parties ?? ['identity', 'answers'])
          entries.push({
            kind: 'mcp_write',
            entity: 'widget_input',
            entityId: inputId,
            before: null,
            after: { sourceKind: 'idea' }
          })
        }
        this.deps.blocks.log(batchId, entries, 'claude')
      })
    } catch (error) {
      if (error instanceof AppError) throw new McpToolError('CODE_REFUSE', error.message)
      throw error
    }
    this.deps.emit({ batchId, summary: 'Claude : 1 widget', count: 1 })
    return {
      text: `Widget posé : ${blockId}, « À revoir » — il ne reçoit aucune donnée avant l’autorisation de mentalyas.`,
      data: { id: blockId, lot: batchId, etat: 'a_revoir' }
    }
  }
}

function summaryOf(parts: ReadonlyArray<readonly [number, string, string]>): string {
  const text = parts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
  return text.length === 0 ? 'rien' : text.join(', ')
}
