import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StructureView } from '../../../src/shared/brainstorms/viewState'
import { BrainstormScope } from '../../../src/main/application/brainstorms/BrainstormScope'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { BrainstormRepository } from '../../../src/main/infrastructure/db/repositories/BrainstormRepository'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('chaque vue de la carte a ses propres blocs (spec 023 D25)', () => {
  let dir: string
  let handle: DatabaseHandle
  let brainstorms: BrainstormRepository
  let scope: BrainstormScope
  let shown: StructureView | null
  let blocks: BlockRepository

  const block = (kind: 'widget' | 'label' = 'widget', sourceBlockId?: string) =>
    blocks.insert({
      kind,
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      text: null,
      ...(sourceBlockId === undefined ? {} : { sourceBlockId })
    })

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-block-view-'))
    handle = openDatabase({ file: join(dir, 'g.db'), key: '9'.repeat(64), migrationsFolder: MIGRATIONS })
    brainstorms = new BrainstormRepository(handle.db)
    scope = new BrainstormScope(() => brainstorms.ensureLoose())
    const canvas = brainstorms.insert({
      name: 'PID',
      slug: `pid-${randomUUID().slice(0, 8)}`,
      description: '',
      type: null,
      location: 'external',
      origin: 'existing',
      folderPath: join(dir, 'pid'),
      gitRole: 'none',
      github: false
    })
    scope.set(canvas.id)
    shown = 'workflow'
    blocks = new BlockRepository(handle.db, scope, () => shown)
  })
  afterEach(() => {
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should_file_a_new_block_in_the_view_shown_and_its_result_frame_with_its_widget', () => {
    const widget = block()
    shown = 'progression'
    const result = blocks.insert({
      kind: 'result',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      text: null,
      sourceBlockId: widget.id
    })
    expect(blocks.get(widget.id)?.view).toBe('workflow')
    expect(result.view).toBe('workflow')
    expect(block('label').view).toBe('progression')
  })

  it('should_leave_a_block_in_every_view_when_the_canvas_has_none', () => {
    shown = null
    expect(blocks.get(block().id)?.view).toBeNull()
  })

  it('should_file_older_blocks_once_in_the_view_shown_and_send_a_widget_with_its_result_elsewhere', () => {
    shown = null
    const older = block()
    const result = block('label', older.id)
    const active = scope.active() ?? ''
    expect(blocks.assignViewless(active, 'progression')).toBe(2)
    expect(blocks.assignViewless(active, 'workflow')).toBe(0)
    expect(blocks.get(older.id)?.view).toBe('progression')
    blocks.setView(older.id, 'architecture')
    expect([blocks.get(older.id)?.view, blocks.get(result.id)?.view]).toEqual(['architecture', 'architecture'])
  })
})
