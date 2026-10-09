import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { FileSummaryRepository } from '../../../src/main/infrastructure/db/repositories/FileSummaryRepository'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const G = '00000000-0000-4000-8000-0000000000f2'

describe('explications enregistrées (spec 023 D18)', () => {
  let dir: string
  let handle: DatabaseHandle

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-summaries-'))
    handle = openDatabase({ file: join(dir, 's.db'), key: 'e'.repeat(64), migrationsFolder: MIGRATIONS })
  })
  afterEach(() => {
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should_keep_one_explanation_per_file_and_replace_it_when_a_new_one_is_written', () => {
    const repository = new FileSummaryRepository(handle.db)
    expect(repository.get(G, 'src/a.ts')).toBeUndefined()
    repository.put(G, 'src/a.ts', { contentHash: 'h1', summaryJson: '{"role":"un"}' })
    repository.put(G, 'src/b.ts', { contentHash: 'h9', summaryJson: '{"role":"autre"}' })
    repository.put(G, 'src/a.ts', { contentHash: 'h2', summaryJson: '{"role":"deux"}' })
    expect(repository.get(G, 'src/a.ts')).toEqual({ contentHash: 'h2', summaryJson: '{"role":"deux"}' })
    expect(repository.get(G, 'src/b.ts')?.contentHash).toBe('h9')
    // Un chemin piégé reste une valeur (requête paramétrée).
    repository.put(G, "src/x'); DROP TABLE code_file_summaries;--", { contentHash: 'h', summaryJson: '{}' })
    expect(repository.get(G, 'src/a.ts')?.contentHash).toBe('h2')
  })
})
