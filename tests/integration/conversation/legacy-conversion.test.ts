import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { convertLegacyIdeas } from '../../../src/main/application/conversation/LegacyConversion'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { readSheet } from '../../../src/main/domain/conversation/sheet'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { LegacyRepository } from '../../../src/main/infrastructure/db/repositories/LegacyRepository'
import {
  canvasBlocks,
  extensions,
  mapLinks,
  neuronLinks,
  neurons,
  planNodes,
  reflectionSummaries,
  widgetInputs
} from '../../../src/main/infrastructure/db/schemaNeurons'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('conversion des idées de l’ancien moteur au démarrage (spec 010 US3)', () => {
  let dir: string
  let handle: DatabaseHandle
  let history: HistoryService

  const open = (): void => {
    handle = openDatabase({ file: join(dir, 'c.db'), key: '7'.repeat(64), migrationsFolder: MIGRATIONS })
    history = new HistoryService(new HistoryRepository(handle.db))
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-legacy-'))
    open()
  })
  afterEach(() => {
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  const convert = () => convertLegacyIdeas(new LegacyRepository(handle.db))
  const sheetOf = (id: string) =>
    handle.db.select({ sheetJson: neurons.sheetJson }).from(neurons).where(eq(neurons.id, id)).get()?.sheetJson ?? null

  function root(id: string, title: string, sheetJson: string | null = null): void {
    handle.db
      .insert(neurons)
      .values({ id, rootId: id, kind: 'root', title, origin: 'user', state: 'hatched', sheetJson })
      .run()
  }

  /** Idée éclose en synthèse de réflexion, avec une question répondue. */
  function hatchedReflection(id: string): void {
    root(id, 'Ouvrir un studio photo')
    handle.db
      .insert(extensions)
      .values({
        id: `${id}-q`,
        rootId: id,
        neuronId: id,
        question: 'Quelle ville ?',
        dimension: 'Lieu',
        status: 'answered',
        origin: 'ai'
      })
      .run()
    handle.db
      .insert(neurons)
      .values({
        id: `${id}-a`,
        rootId: id,
        parentId: id,
        depth: 1,
        kind: 'answer',
        title: 'Lieu : Liège',
        content: 'Liège',
        origin: 'user',
        fromExtensionId: `${id}-q`,
        absorbedIn: 's1'
      })
      .run()
    handle.db
      .insert(reflectionSummaries)
      .values({
        id: `${id}-r`,
        rootId: id,
        synthesisId: 's1',
        keyPointsJson: JSON.stringify([{ headline: 'Clientèle', text: 'Mariages', sourceIds: [`${id}-a`] }]),
        decisionsJson: JSON.stringify(['Commencer en location']),
        prosJson: '[]',
        consJson: '[]',
        openQuestionsJson: JSON.stringify([{ text: 'Quel budget ?' }]),
        overview: 'Un studio à Liège',
        nextStep: 'Visiter trois locaux'
      })
      .run()
  }

  it('should_give_a_sheet_built_from_the_document_and_answers_when_an_old_idea_was_hatched', () => {
    hatchedReflection('studio')
    const result = convert()
    expect(result.sheets).toBe(1)
    expect(readSheet(sheetOf('studio'))).toEqual({
      resume: 'Un studio à Liège',
      points_cles: ['Prochaine étape : Visiter trois locaux', 'Clientèle : Mariages', 'Quelle ville ? → Liège'],
      decisions: ['Commencer en location'],
      questions_ouvertes: ['Quel budget ?'],
      manques: []
    })
  })

  it('should_read_the_current_action_plan_when_the_idea_hatched_into_a_plan', () => {
    root('objectif', 'Acheter un 70-200')
    handle.db
      .insert(planNodes)
      .values([
        { id: 'p1', rootId: 'objectif', synthesisId: 's2', type: 'task', title: 'Comparer les prix', status: 'ready' },
        {
          id: 'p0',
          rootId: 'objectif',
          synthesisId: 's0',
          type: 'task',
          title: 'Ancien plan',
          status: 'ready',
          isCurrent: false
        }
      ])
      .run()
    convert()
    expect(readSheet(sheetOf('objectif')).points_cles).toEqual([
      'Prochaine étape : Comparer les prix',
      'Tâche (à faire) : Comparer les prix'
    ])
  })

  it('should_never_touch_an_idea_that_already_has_a_sheet_from_claude', () => {
    const claudeSheet = JSON.stringify({ resume: 'Tenue par Claude' })
    root('genesis', 'Déjà converti', claudeSheet)
    convert()
    expect(sheetOf('genesis')).toBe(claudeSheet)
  })

  it('should_leave_no_sheet_when_the_old_idea_had_neither_answers_nor_document', () => {
    root('brute', 'Idée brute')
    expect(convert()).toEqual({ sheets: 0, links: 0, stepInputs: 0, batchId: null })
    expect(sheetOf('brute')).toBeNull()
  })

  it('should_convert_only_once_even_after_a_restart', () => {
    hatchedReflection('studio')
    expect(convert().sheets).toBe(1)
    // Une idée apparue ensuite (ou une fiche effacée) n'est plus convertie : le marqueur est posé.
    hatchedReflection('autre')
    handle.close()
    open()
    expect(convert()).toEqual({ sheets: 0, links: 0, stepInputs: 0, batchId: null })
    expect(sheetOf('autre')).toBeNull()
  })

  it('should_mark_the_conversion_as_done_even_when_there_was_nothing_to_convert', () => {
    expect(convert().sheets).toBe(0)
    hatchedReflection('studio')
    expect(convert().sheets).toBe(0)
  })

  it('should_record_one_undoable_history_batch_and_remove_the_sheets_when_undone', () => {
    hatchedReflection('studio')
    hatchedReflection('voyage')
    const { batchId } = convert()
    const [entry] = history.list().items
    expect(entry).toMatchObject({
      batchId,
      kind: 'convert',
      summary: 'Conversion de l’ancien moteur : 2 fiches',
      undoable: true
    })

    history.undo(batchId ?? '')
    expect(sheetOf('studio')).toBeNull()
    expect(sheetOf('voyage')).toBeNull()
    expect(history.list().items[0]?.summary).toBe('Conversion de l’ancien moteur annulée : 2 fiches')
    // L'annulation est définitive pour la conversion : elle ne repart pas au démarrage suivant.
    expect(convert().sheets).toBe(0)
  })

  it('should_refuse_to_undo_when_a_converted_sheet_was_changed_since', () => {
    hatchedReflection('studio')
    const { batchId } = convert()
    handle.db
      .update(neurons)
      .set({ sheetJson: JSON.stringify({ resume: 'Complétée par Claude' }) })
      .where(eq(neurons.id, 'studio'))
      .run()
    expect(() => history.undo(batchId ?? '')).toThrow(/la situation a changé/)
  })

  function link(id: string, a: string, b: string, status: 'accepted' | 'suggested', label = ''): void {
    handle.db
      .insert(neuronLinks)
      .values({ id, aRootId: a, bRootId: b, label, origin: 'user', status, fingerprint: id })
      .run()
  }

  const activeMapLinks = () =>
    handle.db
      .select()
      .from(mapLinks)
      .all()
      .filter((row) => row.deletedAt === null)

  it('should_turn_accepted_links_between_ideas_into_free_map_links_and_drop_suggestions', () => {
    root('a', 'Studio')
    root('b', 'Objectif')
    root('c', 'Voyage')
    link('l1', 'a', 'b', 'accepted', 'finance')
    link('l2', 'a', 'c', 'accepted')
    link('l3', 'b', 'c', 'suggested', 'proposé par l’IA')
    expect(convert()).toMatchObject({ sheets: 0, links: 2, stepInputs: 0 })
    expect(
      activeMapLinks().map((row) => ({
        from: row.fromId,
        to: row.toId,
        label: row.label,
        kinds: [row.fromKind, row.toKind]
      }))
    ).toEqual([
      { from: 'a', to: 'b', label: 'finance', kinds: ['idea', 'idea'] },
      { from: 'a', to: 'c', label: null, kinds: ['idea', 'idea'] }
    ])
  })

  it('should_not_duplicate_a_link_already_drawn_as_a_free_link_in_either_direction', () => {
    root('a', 'Studio')
    root('b', 'Objectif')
    link('l1', 'a', 'b', 'accepted')
    handle.db
      .insert(mapLinks)
      .values({ id: 'm1', fromKind: 'idea', fromId: 'b', toKind: 'idea', toId: 'a', origin: 'claude' })
      .run()
    expect(convert().links).toBe(0)
    expect(activeMapLinks()).toHaveLength(1)
  })

  function widget(id: string): void {
    handle.db.insert(canvasBlocks).values({ id, kind: 'widget', x: 0, y: 0, width: 520, height: 440 }).run()
  }

  it('should_plug_the_idea_itself_instead_of_its_next_step_into_the_widget', () => {
    root('a', 'Studio')
    widget('w1')
    handle.db.insert(widgetInputs).values({ id: 'in1', blockId: 'w1', sourceKind: 'step', sourceId: 'a' }).run()
    expect(convert()).toMatchObject({ stepInputs: 1 })
    const rows = handle.db.select().from(widgetInputs).all()
    expect(rows.filter((row) => row.deletedAt === null).map((row) => [row.sourceKind, row.sourceId])).toEqual([
      ['idea', 'a']
    ])
    // Le document de l'idée (son ancienne prochaine étape) est transmis par les annexes (spec 015).
    expect(JSON.parse(rows.find((row) => row.sourceKind === 'idea')?.partsJson ?? '[]')).toContain('annexes')
  })

  it('should_only_unplug_the_step_when_the_widget_already_receives_the_idea', () => {
    root('a', 'Studio')
    widget('w1')
    handle.db
      .insert(widgetInputs)
      .values([
        { id: 'in1', blockId: 'w1', sourceKind: 'idea', sourceId: 'a' },
        { id: 'in2', blockId: 'w1', sourceKind: 'step', sourceId: 'a' }
      ])
      .run()
    convert()
    const active = handle.db
      .select()
      .from(widgetInputs)
      .all()
      .filter((row) => row.deletedAt === null)
    expect(active.map((row) => row.id)).toEqual(['in1'])
    // Rien de nouveau n'est branché : seule l'étape est débranchée.
    expect(handle.db.select().from(widgetInputs).all()).toHaveLength(2)
  })

  it('should_undo_links_and_plugs_with_the_sheets_in_one_go', () => {
    hatchedReflection('studio')
    root('b', 'Objectif')
    link('l1', 'studio', 'b', 'accepted')
    widget('w1')
    handle.db.insert(widgetInputs).values({ id: 'in1', blockId: 'w1', sourceKind: 'step', sourceId: 'studio' }).run()
    const { batchId } = convert()
    expect(history.list().items[0]?.summary).toBe('Conversion de l’ancien moteur : 1 fiche, 1 lien, 1 branchement')

    history.undo(batchId ?? '')
    expect(sheetOf('studio')).toBeNull()
    expect(activeMapLinks()).toHaveLength(0)
    const active = handle.db
      .select()
      .from(widgetInputs)
      .all()
      .filter((row) => row.deletedAt === null)
    expect(active.map((row) => [row.id, row.sourceKind])).toEqual([['in1', 'step']])
    expect(history.list().items[0]?.summary).toBe(
      'Conversion de l’ancien moteur annulée : 1 fiche, 1 lien, 1 branchement'
    )
  })

  it('should_keep_the_old_tables_untouched', () => {
    hatchedReflection('studio')
    convert()
    expect(handle.db.select().from(reflectionSummaries).all()).toHaveLength(1)
    expect(handle.db.select().from(extensions).all()).toHaveLength(1)
  })
})
