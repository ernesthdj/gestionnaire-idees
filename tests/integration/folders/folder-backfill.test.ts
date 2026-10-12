import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FolderService } from '../../../src/main/application/folders/FolderService'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { DocumentRepository } from '../../../src/main/infrastructure/db/repositories/DocumentRepository'
import { FolderRepository } from '../../../src/main/infrastructure/db/repositories/FolderRepository'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const KEY = '7'.repeat(64)

/**
 * Spec 028 T012 (research R11) : la migration 0047 reprend les documents de la spec 012 — un document arrangé à la
 * main reste épinglé à sa place, les autres passent dans le dossier de leur nœud sans être « nouveaux » ; un document
 * retiré n'est nulle part ; le `down` rend la base d'avant.
 */
describe('reprise des documents de la spec 012 dans les dossiers (migration 0047)', () => {
  let root: string
  let file: string
  let handle: DatabaseHandle | undefined

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-folder-backfill-'))
    file = join(root, 'g.db')
    // Base à l'état 0046 : le journal des migrations s'arrête juste avant 0047.
    const before = join(root, 'migrations-0046')
    cpSync(MIGRATIONS, before, { recursive: true })
    const journalPath = join(before, 'meta', '_journal.json')
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] }
    journal.entries = journal.entries.filter((entry) => entry.tag < '0047')
    writeFileSync(journalPath, JSON.stringify(journal))
    const old = openDatabase({ file, key: KEY, migrationsFolder: before })
    old.db.run(
      sql`INSERT INTO neurons (id, root_id, kind, title, origin) VALUES ('g1', 'g1', 'root', 'Genesis', 'user')`
    )
    const insert = (id: string, extra: string): void => {
      old.db.run(
        sql.raw(
          `INSERT INTO documents (id, neuron_id, genesis_id, title, folder, file_name, width, height, origin, offset_x,
           offset_y, deleted_at) VALUES ('${id}', 'g1', 'g1', '${id}', 'profile', '${id}.md', ${extra})`
        )
      )
      old.db.run(
        sql.raw(
          `INSERT INTO document_versions (id, document_id, content, hash, author, created_at)
           VALUES ('v-${id}', '${id}', 'x', 'h', 'claude', '2026-10-01T10:00:00.000Z')`
        )
      )
    }
    insert('intact', `360, 280, 'claude', 0, 0, NULL`)
    insert('deplace', `360, 280, 'claude', 120, -40, NULL`)
    insert('agrandi', `520, 400, 'user', 0, 0, NULL`)
    insert('retire', `360, 280, 'claude', 0, 0, '2026-10-02T00:00:00.000Z'`)
    old.close()
  })
  afterEach(() => {
    handle?.close()
    rmSync(root, { recursive: true, force: true })
  })

  const upgrade = (): DatabaseHandle => {
    handle = openDatabase({ file, key: KEY, migrationsFolder: MIGRATIONS })
    return handle
  }

  it('should_pin_arranged_documents_and_file_the_others_without_marking_them_new', () => {
    const { db } = upgrade()
    const documents = new DocumentRepository(db)
    expect(
      documents
        .list()
        .map((document) => [document.id, document.pinned])
        .sort()
    ).toEqual([
      ['agrandi', true],
      ['deplace', true],
      ['intact', false]
    ])
    const badges = new FolderService({ repository: new FolderRepository(db), documents }).badges(new Set(['g1']))
    expect(badges).toEqual([
      expect.objectContaining({
        neuronId: 'g1',
        count: 1,
        unseen: false,
        preview: [expect.objectContaining({ name: 'intact.md', source: 'document', unseen: false })]
      })
    ])
  })

  it('should_restore_the_previous_base_when_the_down_script_runs', () => {
    const { db } = upgrade()
    const down = readFileSync(join(MIGRATIONS, 'down', '0047_node_folders.down.sql'), 'utf8')
    for (const statement of down
      .replace(/--.*$/gm, '')
      .split(';')
      .map((part) => part.trim())) {
      if (statement !== '') db.run(sql.raw(statement))
    }
    const columns = db.all<{ name: string }>(sql`PRAGMA table_info(documents)`).map((column) => column.name)
    expect(columns).not.toContain('pinned')
    expect(db.all(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'folders'`)).toEqual([])
  })
})
