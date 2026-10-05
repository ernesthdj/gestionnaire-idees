import { randomUUID } from 'node:crypto'
import type { HistoryEntryView, HistoryPageView } from '@shared/ipc/history'
import { AppError } from '../../domain/errors'
import type {
  BatchRow,
  ChangeRow,
  HistoryRepository,
  Snapshot
} from '../../infrastructure/db/repositories/HistoryRepository'

/**
 * Types de lots annulables : éclosion, liens, graine acceptée, idée supprimée, écritures de Claude, conversion de
 * l'ancien moteur, et une annulation (qui se rétablit).
 */
const UNDOABLE = new Set([
  'confirm_synthesis',
  'link',
  'seed',
  'delete',
  'promote',
  'undo',
  'mcp_write',
  'convert',
  'plan',
  'document'
])
/** Éléments dont l'état n'est pas comparé : dépendances (liées à leurs tâches), exemples (élagués au fil de l'eau). */
/** Questions et idées suggérées closes à l'éclosion : leur statut ne bloque jamais une annulation. */
const UNCHECKED = new Set(['plan_dependency', 'example', 'extension', 'suggestion'])

const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  neuron: 'L’idée a changé depuis (réouverte, complétée ou déjà modifiée).',
  synthesis: 'La synthèse a changé depuis.',
  plan_node: 'Le plan a été remplacé depuis.',
  reflection_summary: 'La synthèse de réflexion a été remplacée depuis.',
  neuron_link: 'Ce lien a été modifié depuis.',
  link_seed: 'Cette graine a changé depuis (son lien a peut-être été supprimé).',
  neuron_placement: 'L’idée éclose à part a changé depuis (elle a été développée ou déplacée).',
  neuron_absorb: 'Une réponse rangée dans le document a changé depuis (supprimée ou reprise).',
  canvas_block: 'Ce bloc a changé depuis.',
  map_link: 'Ce lien a changé depuis.',
  block_text: 'Cette note a été modifiée depuis.',
  neuron_text: 'Cette idée a été modifiée depuis.',
  neuron_sheet: 'La fiche a été modifiée depuis.',
  step: 'Une étape du plan a changé depuis.',
  step_rank: 'L’ordre du plan a changé depuis.',
  step_status: 'Le statut d’une étape a changé depuis.',
  step_dependency: 'Une dépendance du plan a changé depuis.',
  neuron_lock: 'Le verrou a changé depuis.',
  element: 'Un élément de la carte a changé depuis.',
  widget_input: 'Ce branchement a changé depuis.'
}

const BLOCK_NAMES: Readonly<Record<string, string>> = {
  label: 'une note',
  widget: 'un widget',
  result: 'un cadre résultat',
  empty: 'un bloc'
}

/**
 * Lot d'un document (spec 012) : « Document « X » », « Modification de « X » », « Retrait du document « X » ». Le titre
 * voyage dans l'entrée (avant ou après) ; `null` si le lot ne concerne pas un document.
 */
function documentSummary(entries: readonly ChangeRow[]): string | null {
  const entry = entries.find((row) => row.entity.startsWith('document'))
  if (entry === undefined) return null
  const raw = entry.after?.['title'] ?? entry.before?.['title']
  const title = typeof raw === 'string' ? `« ${raw} »` : 'un document'
  if (entry.entity === 'document_version') return `Modification de ${title}`
  if (entry.entity === 'document_placement') return `Retrait du document ${title}`
  return `Document ${title}`
}

/** Contenu d'un lot de conversion (spec 010) : « 3 fiches, 2 liens, 1 branchement ». */
function conversionCounts(entries: readonly ChangeRow[], undo: boolean): string {
  // Dans un lot d'annulation, avant et après sont inversés.
  const original = (entry: ChangeRow): Snapshot => (undo ? entry.after : entry.before)
  const counts: ReadonlyArray<readonly [number, string, string]> = [
    [entries.filter((entry) => entry.entity === 'neuron_sheet').length, 'fiche', 'fiches'],
    [entries.filter((entry) => entry.entity === 'map_link').length, 'lien', 'liens'],
    [
      entries.filter((entry) => entry.entity === 'widget_input' && original(entry)?.['sourceKind'] === 'step').length,
      'branchement',
      'branchements'
    ]
  ]
  return counts
    .filter(([count]) => count > 0)
    .map(([count, one, many]) => `${count} ${count > 1 ? many : one}`)
    .join(', ')
}

/** Suppression d'un bloc de la carte (spec 004), ou son annulation. */
function blockSummary(entry: ChangeRow): string {
  const kind = entry.before?.['kind'] ?? entry.after?.['kind']
  const name = BLOCK_NAMES[typeof kind === 'string' ? kind : 'empty'] ?? 'un bloc'
  if (entry.kind === 'delete') return `Suppression d’${name}`
  return entry.after === null ? `Suppression d’${name} rétablie` : `Restauration d’${name}`
}

/**
 * Lot d'écritures de Claude Code par le pont MCP (spec 007) ou son annulation : « Claude : 12 notes, 1 cadre, 9 liens ».
 */
function mcpSummary(entries: readonly ChangeRow[], undo: boolean): string {
  const kindOf = (entry: ChangeRow): unknown => entry.after?.['kind'] ?? entry.before?.['kind']
  // Dans un lot d'annulation, avant et après sont inversés : un élément « créé » est celui qui disparaît.
  const created = (entry: ChangeRow): boolean => (undo ? entry.after === null : entry.before === null)
  const removed = (entry: ChangeRow): boolean => (undo ? entry.before === null : entry.after === null)
  const block = (entry: ChangeRow): boolean => entry.entity === 'canvas_block'
  const counted: ReadonlyArray<readonly [(entry: ChangeRow) => boolean, string, string]> = [
    [(e) => block(e) && created(e) && kindOf(e) === 'note', 'note', 'notes'],
    [(e) => block(e) && created(e) && kindOf(e) === 'frame', 'cadre', 'cadres'],
    [(e) => block(e) && created(e) && kindOf(e) === 'widget', 'widget', 'widgets'],
    [(e) => e.entity === 'neuron' && created(e), 'idée', 'idées'],
    [(e) => e.entity === 'map_link' && created(e), 'lien', 'liens'],
    [(e) => e.entity === 'block_text' || e.entity === 'neuron_text', 'modification', 'modifications'],
    [(e) => e.entity === 'neuron_sheet', 'fiche', 'fiches'],
    [(e) => e.entity === 'element' && created(e), 'élément', 'éléments'],
    [(e) => e.entity === 'element' && e.before !== null && e.after !== null, 'mise à jour', 'mises à jour'],
    [
      (e) => (block(e) || e.entity === 'neuron' || e.entity === 'map_link' || e.entity === 'element') && removed(e),
      'retrait',
      'retraits'
    ]
  ]
  const parts = counted.flatMap(([test, one, many]) => {
    const n = entries.filter(test).length
    return n === 0 ? [] : [`${n} ${n === 1 ? one : many}`]
  })
  const detail = parts.length === 0 ? 'carte' : parts.join(', ')
  return undo ? `Annulation — Claude : ${detail}` : `Claude : ${detail}`
}

/** Débranchement d'une source d'un widget (spec 005), ou son annulation. */
function inputSummary(entry: ChangeRow): string {
  if (entry.kind === 'delete') return 'Débranchement d’une entrée de widget'
  return entry.after === null ? 'Débranchement d’une entrée de widget rétabli' : 'Entrée de widget rebranchée'
}

/** L'état actuel correspond-il à celui laissé par le lot ? (clés communes seulement ; `null` = absent). */
function matches(current: Snapshot, expected: Snapshot): boolean {
  if (expected === null || current === null) return expected === current
  return Object.keys(current).every((key) => !(key in expected) || current[key] === expected[key])
}

/** Lecture et restauration d'un type d'élément géré hors de `HistoryRepository`. */
export interface EntityHandler {
  snapshot(id: string): Snapshot
  apply(id: string, target: Snapshot): void
}

/**
 * Historique et annulation par lot (spec 003 US6, FR-024, research R6). Une annulation écrit un lot inverse
 * (état réel capturé avant restauration) : annuler une annulation rétablit donc exactement l'état défait.
 */
export class HistoryService {
  constructor(
    private readonly repository: HistoryRepository,
    /** Éléments dont l'état vit aussi hors de la base (fichiers des documents, spec 012). */
    private readonly handlers: Readonly<Record<string, EntityHandler>> = {}
  ) {}

  private snapshot(entity: string, id: string): Snapshot {
    return this.handlers[entity]?.snapshot(id) ?? this.repository.snapshot(entity, id)
  }

  private apply(entity: string, id: string, target: Snapshot): void {
    const handler = this.handlers[entity]
    if (handler === undefined) this.repository.apply(entity, id, target)
    else handler.apply(id, target)
  }

  list(input: { readonly cursor?: string; readonly limit?: number } = {}): HistoryPageView {
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 100)
    const beforeSeq = input.cursor !== undefined && /^\d+$/.test(input.cursor) ? Number(input.cursor) : undefined
    const batches = this.repository.batches(limit + 1, beforeSeq)
    const page = batches.slice(0, limit)
    const last = page.at(-1)
    return {
      items: page.map((batch) => this.view(batch)),
      nextCursor: batches.length > limit && last !== undefined ? String(last.seq) : null
    }
  }

  undo(batchId: string): { readonly undoBatchId: string } {
    const { repository } = this
    return repository.transaction(() => {
      const entries = repository.entries(batchId)
      const head = entries[0]
      if (head === undefined) throw new AppError('NOT_FOUND', 'Changement introuvable')
      if (!UNDOABLE.has(head.kind)) throw new AppError('NOT_UNDOABLE', 'Ce changement ne peut pas être annulé')
      if (entries.some((entry) => entry.undoneByBatch !== null)) {
        throw new AppError('ALREADY_UNDONE', 'Ce changement a déjà été annulé')
      }

      const conflicts = [
        ...new Set(
          entries
            .filter((entry) => !UNCHECKED.has(entry.entity))
            .filter((entry) => !matches(this.snapshot(entry.entity, entry.entityId), entry.after))
            .map((entry) => CONFLICT_MESSAGES[entry.entity] ?? 'Un élément a changé depuis.')
        )
      ]
      if (conflicts.length > 0) {
        throw new AppError('UNDO_CONFLICT', 'Annulation impossible : la situation a changé depuis.', { conflicts })
      }
      this.assertNoOrphanedChildren(entries)

      const undoBatchId = randomUUID()
      const inverse = [...entries].reverse().map((entry) => {
        const current = this.snapshot(entry.entity, entry.entityId)
        this.apply(entry.entity, entry.entityId, entry.before)
        return {
          kind: 'undo' as const,
          entity: entry.entity,
          entityId: entry.entityId,
          before: current,
          after: entry.before
        }
      })
      // Une idée qui n'est plus éclose perd les suggestions de liens nées de son éclosion.
      for (const entry of entries) {
        if (
          entry.entity === 'neuron' &&
          entry.before?.['state'] !== 'hatched' &&
          entry.after?.['state'] === 'hatched'
        ) {
          repository.deleteSuggestedLinks(entry.entityId)
        }
      }
      repository.write(undoBatchId, inverse)
      repository.markUndone(batchId, undoBatchId)
      return { undoBatchId }
    })
  }

  private view(batch: BatchRow): HistoryEntryView {
    const head = batch.entries[0] as ChangeRow
    const undone = batch.entries.some((entry) => entry.undoneByBatch !== null)
    return {
      batchId: batch.batchId,
      kind: head.kind,
      actor: head.actor,
      rootId: this.rootOf(batch.entries),
      summary: this.summarize(batch.entries),
      at: head.createdAt,
      undoable: UNDOABLE.has(head.kind) && !undone,
      undone
    }
  }

  private rootOf(entries: readonly ChangeRow[]): string | null {
    // Idée suggérée éclose à part : c'est elle (le premier neurone déplacé) dont on parle.
    const placed = entries.find((entry) => entry.entity === 'neuron_placement')
    if (placed !== undefined) return placed.entityId
    const neuron = entries.find((entry) => entry.entity === 'neuron')
    if (neuron !== undefined) return neuron.entityId
    const link = entries.find((entry) => entry.entity === 'neuron_link')
    const state = link?.after ?? link?.before
    if (typeof state?.['a'] === 'string') return state['a']
    const synthesis = entries.find((entry) => entry.entity === 'synthesis')
    return synthesis === undefined ? null : (this.repository.synthesisRoot(synthesis.entityId) ?? null)
  }

  private summarize(entries: readonly ChangeRow[]): string {
    const head = entries[0] as ChangeRow
    const document = documentSummary(entries)
    if (document !== null) return head.kind === 'undo' ? `Annulé — ${document}` : document
    if (head.kind === 'mcp_write') return mcpSummary(entries, false)
    if (head.kind === 'undo' && this.repository.undoneKind(head.batchId) === 'mcp_write')
      return mcpSummary(entries, true)
    // Étape retirée (spec 011) : l'étape elle-même suit ses descendants (ordre inversé dans une annulation).
    const isStep = (entry: ChangeRow): boolean => entry.entity === 'step'
    const removedStep = head.kind === 'undo' ? entries.find(isStep) : entries.findLast(isStep)
    const stepTitle = removedStep?.before?.['title'] ?? removedStep?.after?.['title']
    if (
      removedStep !== undefined &&
      (head.kind === 'delete' || head.kind === 'undo') &&
      typeof stepTitle === 'string'
    ) {
      if (head.kind === 'delete') return `Suppression de l’étape « ${stepTitle} »`
      if (this.repository.undoneKind(head.batchId) === 'delete') return `Étape restaurée : « ${stepTitle} »`
    }
    if (head.kind === 'plan') return this.planSummary(entries, false)
    if (head.kind === 'undo' && this.repository.undoneKind(head.batchId) === 'plan')
      return this.planSummary(entries, true)
    if (head.kind === 'convert') return `Conversion de l’ancien moteur : ${conversionCounts(entries, false)}`
    if (head.kind === 'undo' && this.repository.undoneKind(head.batchId) === 'convert')
      return `Conversion de l’ancien moteur annulée : ${conversionCounts(entries, true)}`
    if (head.entity === 'canvas_block') return blockSummary(head)
    if (head.entity === 'widget_input') return inputSummary(head)
    const title = (): string => {
      const rootId = this.rootOf(entries)
      return rootId === null ? 'une idée' : `« ${this.repository.rootTitle(rootId) ?? 'idée supprimée'} »`
    }
    switch (head.kind) {
      case 'confirm_synthesis':
        return `Éclosion de ${title()}`
      case 'manual_edit':
        return head.after?.['state'] === 'developing' ? `Réouverture de ${title()}` : `Modification de ${title()}`
      case 'link':
        return this.linkSummary(head)
      case 'seed':
        return `Graine acceptée : ${title()}`
      case 'delete':
        return `Suppression de ${title()}`
      case 'promote':
        return `Idée éclose à part : ${title()}`
      case 'document':
        return 'Document'
      case 'undo': {
        const placed = entries.find((entry) => entry.entity === 'neuron_placement')
        if (placed !== undefined) {
          return placed.after?.['kind'] === 'root'
            ? `Idée de nouveau à part : ${title()}`
            : `Idée remise dans son arbre : ${title()}`
        }
        const seed = entries.find((entry) => entry.entity === 'link_seed')
        if (seed !== undefined) {
          return seed.after?.['status'] === 'accepted' ? `Graine rétablie : ${title()}` : `Graine annulée : ${title()}`
        }
        const neuron = entries.find((entry) => entry.entity === 'neuron')
        // Annulation d'une suppression : l'idée revient (ou repart, si on annule l'annulation).
        if (neuron !== undefined && entries.length === 1 && (neuron.before === null || neuron.after === null)) {
          return neuron.before === null ? `Idée restaurée : ${title()}` : `Idée supprimée de nouveau : ${title()}`
        }
        if (neuron !== undefined) {
          return neuron.after?.['state'] === 'hatched'
            ? `Éclosion rétablie de ${title()}`
            : `Éclosion annulée de ${title()}`
        }
        const link = entries.find((entry) => entry.entity === 'neuron_link')
        return link === undefined
          ? 'Annulation'
          : `Annulation : ${this.linkSummary({ ...link, before: link.after, after: link.before })}`
      }
    }
  }

  /**
   * Garde D6 (spec 011) : une annulation ne déverrouille jamais un nœud dont des sous-nœuds, nés hors de ce lot,
   * s'appuient encore sur le contexte figé.
   */
  private assertNoOrphanedChildren(entries: readonly ChangeRow[]): void {
    const bornHere = new Set(
      entries.filter((entry) => entry.entity === 'step' && entry.before === null).map((entry) => entry.entityId)
    )
    for (const entry of entries) {
      if (entry.entity !== 'neuron_lock' || entry.before?.['locked'] !== false) continue
      const remaining = this.repository.livingChildren(entry.entityId).filter((id) => !bornHere.has(id))
      if (remaining.length > 0) {
        throw new AppError(
          'UNDO_CONFLICT',
          'Annulation impossible : ses sous-nœuds s’appuient sur ce contexte. Annule d’abord leur naissance.',
          { conflicts: ['Des sous-nœuds dépendent de ce verrou.'] }
        )
      }
    }
  }

  /** « Plan de « X » : 3 étapes », « Verrouillage de « X » », et leurs annulations. */
  private planSummary(entries: readonly ChangeRow[], undo: boolean): string {
    // Dans un lot d'annulation, avant et après sont inversés.
    const born = entries.filter(
      (entry) => entry.entity === 'step' && (undo ? entry.after === null : entry.before === null)
    )
    const parentId = (undo ? born[0]?.before : born[0]?.after)?.['parentId']
    const lock = entries.find((entry) => entry.entity === 'neuron_lock')
    const titled = (id: unknown): string =>
      typeof id === 'string' ? `« ${this.repository.rootTitle(id) ?? 'nœud supprimé'} »` : 'un nœud'
    const text =
      born.length > 0
        ? `Plan de ${titled(parentId)} : ${born.length} étape${born.length > 1 ? 's' : ''}`
        : `Verrouillage de ${titled(lock?.entityId)}`
    return undo ? `Annulé — ${text}` : text
  }

  private linkSummary(entry: ChangeRow): string {
    const current = this.repository.snapshot('neuron_link', entry.entityId)
    const labelOf = (state: Snapshot): string | undefined =>
      typeof state?.['label'] === 'string' && state['label'] !== '' ? state['label'] : undefined
    const label = labelOf(entry.after) ?? labelOf(entry.before) ?? labelOf(current)
    const name = label === undefined ? 'un lien' : `le lien « ${label} »`
    if (entry.before === null) return `Création du lien${label === undefined ? '' : ` « ${label} »`}`
    if (entry.after === null) return `Suppression du lien${label === undefined ? '' : ` « ${label} »`}`
    if (entry.after['status'] === 'accepted') return `Acceptation de ${name}`
    if (entry.after['status'] === 'rejected') return `Refus de ${name}`
    return `Renommage : ${name}`
  }
}
