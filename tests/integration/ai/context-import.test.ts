import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ContextImportService } from '../../../src/main/application/ai/ContextImportService'
import { ExampleStore } from '../../../src/main/application/ai/ExampleStore'
import { InboxFolder } from '../../../src/main/infrastructure/context-inbox/InboxFolder'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { ContextRepository } from '../../../src/main/infrastructure/db/repositories/ContextRepository'
import { FICTIVE_EXAMPLES, FICTIVE_PROFILE, writeInbox } from '../../support/contextInbox'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('import de contexte', () => {
  let root: string
  let inbox: string
  let archive: string
  let handle: DatabaseHandle
  let service: ContextImportService
  let examples: ExampleStore
  let notified: string[]

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-context-'))
    inbox = join(root, 'context-inbox')
    archive = join(root, 'context-archive')
    handle = openDatabase({ file: join(root, 'c.db'), key: '1'.repeat(64), migrationsFolder: MIGRATIONS })
    const repository = new ContextRepository(handle.db)
    examples = new ExampleStore(repository)
    notified = []
    service = new ContextImportService({
      repository,
      inbox: new InboxFolder(inbox, archive),
      examples,
      now: () => new Date('2026-09-28T12:00:00Z'),
      onNewImport: (id) => void notified.push(id)
    })
    service.ensureSeed()
  })
  afterEach(() => {
    handle.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('should_create_pending_import_with_diff_and_archive_files_when_inbox_is_valid', () => {
    writeInbox(inbox, { 'profile.md': FICTIVE_PROFILE, 'examples.json': FICTIVE_EXAMPLES })
    service.scan()
    const pending = service.pending()
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({
      status: 'pending',
      diff: { profile: { changed: true }, examples: { after: 2 } }
    })
    expect(notified).toEqual([pending[0]?.id])
    expect(readdirSync(inbox)).toEqual([])
    expect(existsSync(join(archive, pending[0]?.id ?? '', 'profile.md'))).toBe(true)
  })

  it('should_activate_new_version_with_profile_and_examples_when_applied', () => {
    writeInbox(inbox, { 'profile.md': FICTIVE_PROFILE, 'examples.json': FICTIVE_EXAMPLES })
    service.scan()
    const version = service.apply(service.pending()[0]?.id ?? '')
    expect(version).toMatchObject({ version: 2, isActive: true })
    const context = service.activeContext('categoriser')
    expect(context?.profile).toContain('Double casquette')
    expect(context?.examples.map((example) => example.input)).toEqual(['Acheter un flash cobra'])
  })

  it('should_keep_previous_rules_when_import_only_updates_profile', () => {
    writeInbox(inbox, { 'rules.md': 'Tutoiement, phrases courtes.' })
    service.scan()
    service.apply(service.pending()[0]?.id ?? '')
    writeInbox(inbox, { 'profile.md': FICTIVE_PROFILE })
    service.scan()
    service.apply(service.pending()[0]?.id ?? '')
    expect(service.activeContext('etendre')?.rules).toBe('Tutoiement, phrases courtes.')
  })

  it.each([
    ['manifeste illisible', { manifestOverride: '{pas du json' }, /manifeste/i],
    ['empreinte fausse', { tamper: 'profile.md' }, /empreinte/i],
    ['fichier annoncé absent', { listed: ['profile.md', 'rules.md'] }, /absent/i]
  ])('should_reject_import_when_%s', (_label, options, error) => {
    writeInbox(inbox, { 'profile.md': FICTIVE_PROFILE }, options)
    service.scan()
    expect(service.pending()).toEqual([])
    expect(service.history().imports[0]).toMatchObject({ status: 'invalid', error: expect.stringMatching(error) })
    expect(service.activeContext('etendre')?.profile ?? '').toBe('')
  })

  it('should_reject_file_larger_than_50_kb', () => {
    writeInbox(inbox, { 'profile.md': 'x'.repeat(51 * 1024) })
    service.scan()
    expect(service.history().imports[0]).toMatchObject({ status: 'invalid', error: expect.stringMatching(/50 Ko/) })
  })

  it('should_reject_profile_containing_personal_data', () => {
    writeInbox(inbox, { 'profile.md': `${FICTIVE_PROFILE}\nContact : jean@exemple.test, budget 2 000 €` })
    service.scan()
    expect(service.history().imports[0]).toMatchObject({
      status: 'invalid',
      error: expect.stringMatching(/données personnelles/i)
    })
  })

  it('should_reject_examples_containing_personal_data', () => {
    const examples = JSON.stringify([
      { taskKind: 'etendre', polarity: 'positive', input: 'Écrire à jean@exemple.test', output: {} }
    ])
    writeInbox(inbox, { 'examples.json': examples })
    service.scan()
    expect(service.history().imports[0]).toMatchObject({
      status: 'invalid',
      error: expect.stringMatching(/données personnelles/i)
    })
  })

  it('should_reject_malformed_examples_file', () => {
    writeInbox(inbox, { 'examples.json': JSON.stringify([{ taskKind: 'inconnu' }]) })
    service.scan()
    expect(service.history().imports[0]).toMatchObject({ status: 'invalid', error: expect.stringMatching(/exemples/i) })
  })

  it('should_ignore_unlisted_files_when_scanning', () => {
    writeInbox(inbox, { 'profile.md': FICTIVE_PROFILE, 'script.js': 'alert(1)' })
    service.scan()
    expect(service.pending()[0]?.diff.files).toEqual(['profile.md'])
  })

  it('should_leave_active_context_unchanged_when_import_is_rejected', () => {
    writeInbox(inbox, { 'profile.md': FICTIVE_PROFILE })
    service.scan()
    service.reject(service.pending()[0]?.id ?? '')
    expect(service.pending()).toEqual([])
    expect(service.activeContext('etendre')?.profile ?? '').toBe('')
  })

  it('should_restore_previous_version_and_its_examples_when_rolling_back', () => {
    writeInbox(inbox, { 'profile.md': FICTIVE_PROFILE, 'examples.json': FICTIVE_EXAMPLES })
    service.scan()
    service.apply(service.pending()[0]?.id ?? '')
    const seed = service.history().versions.find((version) => version.version === 1)
    service.rollback(seed?.id ?? '')
    const context = service.activeContext('categoriser')
    expect(context?.profile ?? '').toBe('')
    expect(context?.examples ?? []).toEqual([])
    expect(service.history().versions.filter((version) => version.isActive)).toHaveLength(1)
  })

  it('should_refuse_to_apply_an_import_that_is_not_pending', () => {
    writeInbox(inbox, { 'profile.md': FICTIVE_PROFILE })
    service.scan()
    const id = service.pending()[0]?.id ?? ''
    service.reject(id)
    expect(() => service.apply(id)).toThrow(expect.objectContaining({ code: 'INVALID_STATE' }))
  })

  it('should_do_nothing_when_inbox_has_no_manifest', () => {
    service.scan()
    expect(service.history().imports).toEqual([])
  })
})

describe('ExampleStore', () => {
  let root: string
  let handle: DatabaseHandle
  let store: ExampleStore
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-examples-'))
    handle = openDatabase({ file: join(root, 'e.db'), key: '2'.repeat(64), migrationsFolder: MIGRATIONS })
    store = new ExampleStore(new ContextRepository(handle.db))
  })
  afterEach(() => {
    handle.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('should_keep_at_most_20_learned_examples_per_task_kind', () => {
    for (let i = 0; i < 25; i += 1) {
      store.record({ polarity: 'positive', taskKind: 'etendre', input: `idée ${i}`, output: {} })
    }
    expect(store.count('etendre')).toBe(20)
  })

  it('should_select_three_most_recent_examples_of_the_requested_kind_only', () => {
    for (let i = 0; i < 5; i += 1)
      store.record({ polarity: 'positive', taskKind: 'etendre', input: `e${i}`, output: {} })
    store.record({ polarity: 'negative', taskKind: 'synthetiser', input: 's', output: {}, reason: 'trop long' })
    const selected = store.select('etendre', null)
    expect(selected.map((example) => example.input)).toEqual(['e4', 'e3', 'e2'])
  })
})
