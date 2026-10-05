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
import { extensions, neurons, planNodes, reflectionSummaries } from '../../../src/main/infrastructure/db/schemaNeurons'

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
    expect(result.converted).toBe(1)
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
    expect(convert()).toEqual({ converted: 0, batchId: null })
    expect(sheetOf('brute')).toBeNull()
  })

  it('should_convert_only_once_even_after_a_restart', () => {
    hatchedReflection('studio')
    expect(convert().converted).toBe(1)
    // Une idée apparue ensuite (ou une fiche effacée) n'est plus convertie : le marqueur est posé.
    hatchedReflection('autre')
    handle.close()
    open()
    expect(convert()).toEqual({ converted: 0, batchId: null })
    expect(sheetOf('autre')).toBeNull()
  })

  it('should_mark_the_conversion_as_done_even_when_there_was_nothing_to_convert', () => {
    expect(convert().converted).toBe(0)
    hatchedReflection('studio')
    expect(convert().converted).toBe(0)
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
    expect(history.list().items[0]?.summary).toBe('Conversion de l’ancien moteur annulée : 2 fiches retirées')
    // L'annulation est définitive pour la conversion : elle ne repart pas au démarrage suivant.
    expect(convert().converted).toBe(0)
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

  it('should_keep_the_old_tables_untouched', () => {
    hatchedReflection('studio')
    convert()
    expect(handle.db.select().from(reflectionSummaries).all()).toHaveLength(1)
    expect(handle.db.select().from(extensions).all()).toHaveLength(1)
  })
})
