import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadEngine, type Engine } from '../../../src/analysis-worker/engine'
import { processBatch } from '../../../src/analysis-worker/process'
import type { RunWorker } from '../../../src/main/application/reprise/AnalysisService'
import { WorkflowSymbols } from '../../../src/main/application/workflow/WorkflowSymbols'
import type { CodeLang } from '../../../src/shared/ipc/reprise'
import { GRAMMARS_DIR } from '../../support/reprise'

const SOURCE = `export class CarteService {
  lire(id: string): string {
    return id
  }
}

export function ranger(): void {}
`

describe('raccourcis d’un fichier dans le lecteur Workflow (spec 023 D12)', () => {
  let engine: Engine
  let root: string
  // Le processus d'analyse, simulé en direct avec le vrai moteur tree-sitter.
  const direct: RunWorker = (request, onMessage) => {
    void processBatch(engine, request, onMessage)
    return { cancel: () => undefined }
  }
  const service = (runWorker: RunWorker, timeoutMs?: number): WorkflowSymbols =>
    new WorkflowSymbols({
      target: (_genesisId, path) => ({ root, path, lang: (path.endsWith('.ts') ? 'ts' : 'other') as CodeLang }),
      runWorker,
      ...(timeoutMs === undefined ? {} : { timeoutMs })
    })

  beforeAll(async () => {
    engine = await loadEngine(GRAMMARS_DIR)
    root = mkdtempSync(join(tmpdir(), 'gi-workflow-symbols-'))
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'src', 'carte.ts'), SOURCE)
    writeFileSync(join(root, 'src', 'notes.md'), '# Notes\n')
  })
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('should_list_classes_methods_and_functions_with_their_lines_when_a_code_file_is_read', async () => {
    const symbols = await service(direct).symbols('g', 'src/carte.ts')
    expect(symbols).toEqual([
      { name: 'CarteService', kind: 'class', startLine: 1, endLine: 5 },
      { name: 'lire', kind: 'method', startLine: 2, endLine: 4 },
      { name: 'ranger', kind: 'function', startLine: 7, endLine: 7 }
    ])
  })

  it('should_return_no_shortcut_without_running_the_analysis_when_the_language_is_not_analyzed', async () => {
    let ran = false
    const symbols = await service((request, onMessage) => {
      ran = true
      return direct(request, onMessage, () => undefined)
    }).symbols('g', 'src/notes.md')
    expect(symbols).toEqual([])
    expect(ran).toBe(false)
  })

  it('should_return_no_shortcut_when_the_analysis_answers_garbage_fails_or_hangs', async () => {
    const garbage: RunWorker = (_request, onMessage) => {
      onMessage({ type: 'file', id: '0', hash: 'x', lines: 1, extraction: { evil: true } })
      onMessage({ type: 'done', cancelled: false })
      return { cancel: () => undefined }
    }
    expect(await service(garbage).symbols('g', 'src/carte.ts')).toEqual([])
    const crashed: RunWorker = (_request, _onMessage, onExit) => {
      onExit()
      return { cancel: () => undefined }
    }
    expect(await service(crashed).symbols('g', 'src/carte.ts')).toEqual([])
    let cancelled = false
    const hanging: RunWorker = () => ({ cancel: () => (cancelled = true) })
    expect(await service(hanging, 20).symbols('g', 'src/carte.ts')).toEqual([])
    expect(cancelled).toBe(true)
  })
})
