import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { categories, neurons, settings } from '../../../src/main/infrastructure/db/schemaNeurons'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('migrations du modèle de neurones', () => {
  let root: string
  let handle: DatabaseHandle
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-neurons-db-'))
    handle = openDatabase({ file: join(root, 'n.db'), key: '3'.repeat(64), migrationsFolder: MIGRATIONS })
  })
  afterEach(() => {
    handle.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('should_seed_six_categories_and_engine_settings', () => {
    expect(
      handle.db
        .select()
        .from(categories)
        .all()
        .map((row) => row.slug)
    ).toEqual(['general', 'achat', 'projet', 'sortie', 'photo', 'it'])
    expect(handle.db.select().from(settings).all()).toEqual(
      expect.arrayContaining([
        { key: 'neurons.max_ai_depth', valueJson: '6' },
        { key: 'neurons.min_extensions', valueJson: '3' }
      ])
    )
  })

  it('should_index_root_neurons_for_accent_insensitive_full_text_search', () => {
    handle.db
      .insert(neurons)
      .values([
        { id: 'r1', rootId: 'r1', kind: 'root', title: 'Acheter un écran', origin: 'user', state: 'raw' },
        { id: 's1', rootId: 'r1', parentId: 'r1', depth: 1, kind: 'answer', title: 'écran 27 pouces', origin: 'user' }
      ])
      .run()
    const hits = handle.db.all<{ neuron_id: string }>(
      sql`SELECT neuron_id FROM neurons_fts WHERE neurons_fts MATCH ${'ecran'}`
    )
    expect(hits.map((hit) => hit.neuron_id)).toEqual(['r1'])
  })

  it('should_keep_search_index_in_sync_when_a_root_is_renamed_or_deleted', () => {
    handle.db.insert(neurons).values({ id: 'r1', rootId: 'r1', kind: 'root', title: 'Poterie', origin: 'user' }).run()
    handle.db.run(sql`UPDATE neurons SET title = 'Céramique' WHERE id = 'r1'`)
    const match = (term: string) =>
      handle.db.all<{ neuron_id: string }>(sql`SELECT neuron_id FROM neurons_fts WHERE neurons_fts MATCH ${term}`)
    expect(match('poterie')).toEqual([])
    expect(match('ceramique')).toHaveLength(1)
    handle.db.run(sql`DELETE FROM neurons WHERE id = 'r1'`)
    expect(match('ceramique')).toEqual([])
  })

  it('should_refuse_two_sub_neurons_answering_the_same_extension', () => {
    handle.db.insert(neurons).values({ id: 'r1', rootId: 'r1', kind: 'root', title: 'x', origin: 'user' }).run()
    const answer = (id: string) => ({
      id,
      rootId: 'r1',
      parentId: 'r1',
      depth: 1,
      kind: 'answer' as const,
      title: 'réponse',
      origin: 'user' as const,
      fromExtensionId: 'ext-1'
    })
    handle.db.insert(neurons).values(answer('s1')).run()
    expect(() => handle.db.insert(neurons).values(answer('s2')).run()).toThrow()
  })

  const tables = (): string[] =>
    handle.db.all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE type = 'table'`).map((row) => row.name)
  const columns = (table: string): string[] =>
    handle.db.all<{ name: string }>(sql.raw(`PRAGMA table_info(${table})`)).map((row) => row.name)

  const runDown = (name: string): void => {
    const down = readFileSync(resolve(MIGRATIONS, `down/${name}.down.sql`), 'utf8')
    for (const statement of down.split(';').filter((part) => part.replace(/--.*$/gm, '').trim() !== '')) {
      handle.db.run(sql.raw(statement))
    }
  }

  it('should_add_the_document_tables_then_remove_them_with_the_down_migration', () => {
    expect(tables()).toEqual(expect.arrayContaining(['documents', 'document_versions']))
    runDown('0023_documents')
    expect(tables().some((name) => name.startsWith('document'))).toBe(false)
  })

  it('should_add_the_final_action_tables_then_remove_them_with_the_down_migration', () => {
    const added = ['final_actions', 'executions', 'execution_events', 'deliverable_files']
    expect(tables()).toEqual(expect.arrayContaining(added))
    runDown('0025_final_actions')
    expect(tables().some((name) => added.includes(name))).toBe(false)
  })

  it('should_add_the_permission_tables_and_columns_then_remove_them_with_the_down_migration', () => {
    const added = ['permission_rules', 'trusted_projects', 'permission_log']
    const neuronColumns = ['chat_permission_mode', 'chat_extra_dirs_json', 'chat_bypass_confirmed_at']
    expect(tables()).toEqual(expect.arrayContaining(added))
    expect(columns('neurons')).toEqual(expect.arrayContaining(neuronColumns))
    expect(columns('neuron_messages')).toEqual(expect.arrayContaining(['tool_use_id', 'tool_status', 'tool_reason']))
    expect(columns('final_actions')).toEqual(expect.arrayContaining(['committed_hash', 'committed_at']))
    runDown('0027_claude_libre')
    expect(tables().some((name) => added.includes(name))).toBe(false)
    expect(columns('neurons').some((name) => neuronColumns.includes(name))).toBe(false)
    expect(columns('neuron_messages').some((name) => name.startsWith('tool_'))).toBe(false)
    expect(columns('final_actions').some((name) => name.startsWith('committed_'))).toBe(false)
  })

  it('should_add_the_progress_columns_then_remove_them_with_the_down_migration', () => {
    expect(columns('neurons')).toEqual(expect.arrayContaining(['progress', 'progress_note']))
    runDown('0032_element_progress')
    expect(columns('neurons').some((name) => name.startsWith('progress'))).toBe(false)
  })

  it('should_add_the_architecture_columns_then_remove_them_with_the_down_migration', () => {
    const added = ['layer', 'layer_source', 'architecture', 'architecture_reason', 'architecture_source']
    expect(columns('neurons')).toEqual(expect.arrayContaining(added))
    runDown('0031_architecture')
    expect(columns('neurons').some((name) => added.includes(name))).toBe(false)
  })

  it('should_add_the_analyst_tables_and_columns_then_remove_them_with_the_down_migration', () => {
    const added = ['observations', 'analyses', 'proposals', 'analyst_updates']
    expect(tables()).toEqual(expect.arrayContaining(added))
    expect(columns('ai_calls')).toEqual(expect.arrayContaining(['input_fp', 'output_fp']))
    expect(columns('neurons')).toContain('hidden')
    runDown('0030_analyste')
    expect(tables().some((name) => added.includes(name))).toBe(false)
    expect(columns('ai_calls').some((name) => name.endsWith('_fp'))).toBe(false)
    expect(columns('neurons')).not.toContain('hidden')
  })

  it('should_add_the_code_graph_tables_then_remove_them_with_the_down_migration', () => {
    const added = [
      'code_projects',
      'code_modules',
      'code_files',
      'code_symbols',
      'code_edges',
      'code_entry_points',
      'code_overrides',
      'code_runs',
      'code_layout',
      'code_explorer_state'
    ]
    expect(tables()).toEqual(expect.arrayContaining(added))
    runDown('0029_reprise_guide')
    expect(columns('code_projects')).not.toContain('guide_document_id')
    runDown('0028_reprise_projet')
    expect(tables().some((name) => name.startsWith('code_'))).toBe(false)
    expect(tables()).toContain('neurons')
  })

  it('should_add_the_plan_tables_and_columns_then_remove_them_with_the_down_migration', () => {
    expect(tables()).toEqual(expect.arrayContaining(['step_dependencies', 'plan_proposals', 'plan_proposal_items']))
    expect(columns('neurons')).toEqual(expect.arrayContaining(['rank', 'step_status', 'locked_at', 'lock_proposed_at']))

    const down = readFileSync(resolve(MIGRATIONS, 'down/0022_plan_attaque.down.sql'), 'utf8')
    for (const statement of down.split(';').filter((part) => part.replace(/--.*$/gm, '').trim() !== '')) {
      handle.db.run(sql.raw(statement))
    }
    expect(tables()).not.toEqual(expect.arrayContaining(['step_dependencies']))
    expect(tables().some((name) => name.startsWith('plan_proposal'))).toBe(false)
    expect(
      columns('neurons').some((name) => ['rank', 'step_status', 'locked_at', 'lock_proposed_at'].includes(name))
    ).toBe(false)
  })
})
