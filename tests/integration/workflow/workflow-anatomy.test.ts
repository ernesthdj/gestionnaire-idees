import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadEngine, type Engine } from '../../../src/analysis-worker/engine'
import { processBatch } from '../../../src/analysis-worker/process'
import type { RunWorker } from '../../../src/main/application/reprise/AnalysisService'
import { WorkflowAnatomy } from '../../../src/main/application/workflow/WorkflowAnatomy'
import type { CodeLang } from '../../../src/shared/ipc/reprise'
import { GRAMMARS_DIR } from '../../support/reprise'

const SOURCE = `import { store } from './store'

export class CarteService {
  lire(id: string): string {
    return ranger(id)
  }
}

function ranger(id: string): string {
  return id
}
`

describe('anatomie d’un fichier dans le lecteur Workflow (spec 023 D12, D14)', () => {
  let engine: Engine
  let root: string
  // Le processus d'analyse, simulé en direct avec le vrai moteur tree-sitter.
  const direct: RunWorker = (request, onMessage) => {
    void processBatch(engine, request, onMessage)
    return { cancel: () => undefined }
  }
  const service = (runWorker: RunWorker, timeoutMs?: number): WorkflowAnatomy =>
    new WorkflowAnatomy({
      target: (_genesisId, path) => ({ root, path, lang: (path.endsWith('.ts') ? 'ts' : 'other') as CodeLang }),
      runWorker,
      ...(timeoutMs === undefined ? {} : { timeoutMs })
    })

  beforeAll(async () => {
    engine = await loadEngine(GRAMMARS_DIR)
    root = mkdtempSync(join(tmpdir(), 'gi-workflow-anatomy-'))
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'src', 'carte.ts'), SOURCE)
    writeFileSync(join(root, 'src', 'notes.md'), '# Notes\n')
  })
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('should_give_blocks_imports_and_internal_calls_when_a_code_file_is_read', async () => {
    const anatomy = await service(direct).anatomy('g', 'src/carte.ts')
    expect(
      anatomy?.blocks.map(({ name, kind, startLine, endLine, exported, maybeUnused }) => ({
        name,
        kind,
        startLine,
        endLine,
        exported,
        maybeUnused
      }))
    ).toEqual([
      { name: 'CarteService', kind: 'class', startLine: 3, endLine: 7, exported: true, maybeUnused: false },
      { name: 'lire', kind: 'method', startLine: 4, endLine: 6, exported: true, maybeUnused: false },
      { name: 'ranger', kind: 'function', startLine: 9, endLine: 11, exported: false, maybeUnused: false }
    ])
    expect(anatomy?.imports).toEqual([{ source: './store', names: 1, line: 1 }])
    expect(anatomy?.calls).toEqual([{ from: 1, to: 2, line: 5, ambiguous: false }])
  })

  it('should_return_nothing_without_running_the_analysis_when_the_language_is_not_analyzed', async () => {
    let ran = false
    const anatomy = await service((request, onMessage) => {
      ran = true
      return direct(request, onMessage, () => undefined)
    }).anatomy('g', 'src/notes.md')
    expect(anatomy).toBeNull()
    expect(ran).toBe(false)
  })

  it('should_return_nothing_when_the_analysis_answers_garbage_fails_or_hangs', async () => {
    const garbage: RunWorker = (_request, onMessage) => {
      onMessage({ type: 'file', id: '0', hash: 'x', lines: 1, extraction: { evil: true } })
      onMessage({ type: 'done', cancelled: false })
      return { cancel: () => undefined }
    }
    expect(await service(garbage).anatomy('g', 'src/carte.ts')).toBeNull()
    const crashed: RunWorker = (_request, _onMessage, onExit) => {
      onExit()
      return { cancel: () => undefined }
    }
    expect(await service(crashed).anatomy('g', 'src/carte.ts')).toBeNull()
    let cancelled = false
    const hanging: RunWorker = () => ({ cancel: () => (cancelled = true) })
    expect(await service(hanging, 20).anatomy('g', 'src/carte.ts')).toBeNull()
    expect(cancelled).toBe(true)
  })
})
