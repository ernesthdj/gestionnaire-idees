import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasService } from '../../../src/main/application/canvas/CanvasService'
import { seedDemo } from '../../../src/main/infrastructure/db/demo/seedDemo'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { ProjectFileIndex } from '../../../src/main/infrastructure/reprise/ProjectFileIndex'
import type { ElementView } from '../../../src/shared/ipc/canvas'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

const FILES = ['README.md', 'docs/guide.md', 'docs/plan.md', 'src/app.ts', 'src/notes.md', 'config/app.json']

describe('contenu des éléments de carte (spec 017 D18)', () => {
  let harness: NeuronHarness
  let genesisId: string
  let scans: number

  const element = (id: string, paths: readonly string[]): ElementView => ({
    id,
    genesisId,
    parentId: genesisId,
    key: id,
    type: 'module',
    title: id,
    status: null,
    summary: null,
    paths,
    collapsed: false,
    childCount: 0,
    order: null
  })

  beforeEach(() => {
    harness = createNeuronHarness()
    seedDemo(harness.handle.db)
    const neurons = new NeuronRepository(harness.handle.db)
    genesisId = neurons.canvasRoots()[0]?.id ?? ''
    scans = 0
  })
  afterEach(() => harness.dispose())

  const canvas = (elements: ElementView[]) => {
    const index = new ProjectFileIndex({
      scan: () => {
        scans += 1
        return FILES
      }
    })
    return new CanvasService({
      neurons: new NeuronRepository(harness.handle.db),
      blocks: new BlockRepository(harness.handle.db),
      io: { links: () => [] },
      elements: { views: () => elements },
      projectFiles: () => index.files('D:/projet')
    })
  }

  it('should_mark_each_element_doc_or_code_from_the_files_its_paths_cover', () => {
    const view = canvas([
      element('docs', ['docs']),
      element('src', ['src/']),
      element('config', ['config']),
      element('concept', []),
      element('ailleurs', ['tests'])
    ]).get({})
    const content = new Map(view.elements.map((entry) => [entry.id, entry.content]))
    expect(content.get('docs')).toEqual({ kind: 'doc', code: 0, doc: 2 })
    expect(content.get('src')).toEqual({ kind: 'code', code: 1, doc: 1 })
    expect(content.get('config')).toEqual({ kind: 'code', code: 1, doc: 0 })
    expect(content.get('concept')).toBeNull()
    expect(content.get('ailleurs')).toBeNull()
  })

  it('should_scan_the_project_folder_once_per_display_and_reuse_it_for_thirty_seconds', () => {
    const service = canvas([element('docs', ['docs']), element('src', ['src'])])
    service.get({})
    service.get({})
    expect(scans).toBe(1)
  })
})
