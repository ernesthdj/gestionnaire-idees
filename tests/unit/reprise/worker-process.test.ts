import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { loadEngine, type Engine } from '../../../src/analysis-worker/engine'
import { processBatch, type WorkerOutput } from '../../../src/analysis-worker/process'
import { ParseRequest, WorkerMessage } from '../../../src/analysis-worker/protocol'

const GRAMMARS = resolve(import.meta.dirname, '../../../node_modules/@vscode/tree-sitter-wasm/wasm')
const FIXTURES = resolve(import.meta.dirname, '../../fixtures/reprise')

describe('processus d’analyse : un lot de fichiers (spec 017 R2)', () => {
  let engine: Engine
  let root: string
  beforeAll(async () => {
    engine = await loadEngine(GRAMMARS)
  })
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-worker-'))
    cpSync(FIXTURES, root, { recursive: true })
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const run = async (
    files: { path: string; lang: 'ts' | 'js' | 'cs' | 'php'; knownHash?: string | null }[],
    cancelled?: () => boolean
  ): Promise<WorkerOutput[]> => {
    const messages: WorkerOutput[] = []
    const request = ParseRequest.parse({
      type: 'parse',
      root,
      files: files.map((file, index) => ({ id: `f${index}`, knownHash: null, ...file }))
    })
    await processBatch(engine, request, (message) => messages.push(message), cancelled)
    return messages
  }

  it('should_extract_each_file_with_messages_the_main_accepts', async () => {
    const messages = await run([
      { path: 'ts-app/src/core/orderService.ts', lang: 'ts' },
      { path: 'cs-app/Program.cs', lang: 'cs' },
      { path: 'laravel-app/routes/web.php', lang: 'php' }
    ])
    expect(messages.map((message) => message.type)).toEqual(['file', 'file', 'file', 'done'])
    for (const message of messages) expect(WorkerMessage.safeParse(message).success).toBe(true)
  })

  it('should_skip_an_unchanged_file_and_keep_going_after_a_broken_one', async () => {
    const [first] = await run([{ path: 'ts-app/src/main.ts', lang: 'ts' }])
    const hash = first?.type === 'file' ? first.hash : null
    const messages = await run([
      { path: 'ts-app/src/broken.ts', lang: 'ts' },
      { path: 'ts-app/src/main.ts', lang: 'ts', knownHash: hash },
      { path: 'ts-app/src/missing.ts', lang: 'ts' }
    ])
    expect(messages).toEqual([
      expect.objectContaining({ type: 'fileError', id: 'f0', status: 'parse_error', reason: 'erreur de syntaxe' }),
      { type: 'unchanged', id: 'f1' },
      expect.objectContaining({ type: 'fileError', id: 'f2', reason: 'fichier illisible' }),
      { type: 'done', cancelled: false }
    ])
  })

  it('should_flag_a_file_too_large_without_reading_it', async () => {
    writeFileSync(join(root, 'ts-app/src/huge.ts'), 'x'.repeat(1024 * 1024 + 1))
    expect((await run([{ path: 'ts-app/src/huge.ts', lang: 'ts' }]))[0]).toMatchObject({
      type: 'fileError',
      status: 'too_large'
    })
  })

  it('should_stop_between_two_files_when_cancelled', async () => {
    let seen = 0
    const messages = await run(
      [
        { path: 'ts-app/src/main.ts', lang: 'ts' },
        { path: 'ts-app/src/core/orderService.ts', lang: 'ts' }
      ],
      () => seen++ >= 1
    )
    expect(messages.map((message) => message.type)).toEqual(['file', 'done'])
    expect(messages.at(-1)).toEqual({ type: 'done', cancelled: true })
  })

  it.each(['../secret.ts', 'C:/Windows/win.ini', '/etc/passwd'])(
    'should_refuse_a_path_outside_the_project_%s',
    (path) => {
      expect(
        ParseRequest.safeParse({ type: 'parse', root, files: [{ id: 'x', path, lang: 'ts', knownHash: null }] }).success
      ).toBe(false)
    }
  )

  it('should_never_run_anything_from_a_hostile_project', async () => {
    const messages = await run([
      { path: 'hostile-app/src/index.js', lang: 'js' },
      { path: 'hostile-app/scripts/install.js', lang: 'js' }
    ])
    expect(messages.map((message) => message.type)).toEqual(['file', 'file', 'done'])
    expect(existsSync(join(root, 'hostile-app', 'INSTALL_RAN'))).toBe(false)
  })
})
