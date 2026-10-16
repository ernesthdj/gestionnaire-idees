import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PipelineDocuments } from '../../../src/main/application/agents/PipelineDocuments'
import { GLOBAL_JOURNAL_KEEP_ENTRIES, GLOBAL_JOURNAL_MAX_ENTRIES } from '../../../src/shared/agents/documents'

const FIRST = { pass: 1, nature: 'initiale' } as const
const AGAIN = { pass: 2, nature: 'correction', specVersion: 2 } as const

const entries = (text: string): string[] => text.split('\n').filter((l) => l.startsWith('- '))

describe('documents du pipeline', () => {
  let root: string
  let docs: PipelineDocuments
  let clock: number
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-pipeline-'))
    clock = Date.UTC(2026, 9, 15)
    docs = new PipelineDocuments({
      projectDir: join(root, 'projet'),
      profileDir: join(root, 'profil'),
      projectName: 'demo',
      now: () => (clock += 1000)
    })
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('should_let_only_the_po_write_and_modify_the_spec', () => {
    expect(() => docs.writeSpec('T002', 'backend', 'Je réécris la spec')).toThrow(/Product Owner/)
    expect(docs.readSpec('T002')).toBeUndefined()
    docs.writeSpec('T002', 'po', 'Version 1')
    const second = docs.writeSpec('T002', 'po', 'Version 2')
    expect(docs.readSpec('T002')).toEqual(second)
    expect(second.signedBy).toBe('po')
    expect(second).toMatchObject({ version: 2, content: 'Version 2' })
  })

  it('should_reject_task_ids_that_escape_the_pipeline_folder', () => {
    expect(() => docs.writeSpec('../x', 'po', 'a')).toThrow(/invalide/)
    expect(() => docs.writeReport('a/b', { id: 'qa', role: 'qa' }, 'a', FIRST)).toThrow(/invalide/)
    expect(() => docs.writeReport('T002', { id: '../qa', role: 'qa' }, 'a', FIRST)).toThrow(/invalide/)
    expect(existsSync(join(root, 'x'))).toBe(false)
  })

  it('should_keep_one_report_per_agent_and_list_them_in_order', () => {
    docs.writeReport('T002', { id: 'back-1', role: 'backend' }, 'Fait côté main', FIRST)
    docs.writeReport('T002', { id: 'back-2', role: 'backend' }, 'Fait côté base', FIRST)
    docs.writeReport('T002', { id: 'qa', role: 'qa' }, 'Tests verts', FIRST)
    docs.writeReport('T002', { id: 'back-1', role: 'backend' }, 'Repris après le QA', AGAIN)
    const reports = docs.listReports('T002')
    expect(reports.map((r) => r.agentId)).toEqual(['back-2', 'qa', 'back-1'])
    expect(reports[2]).toMatchObject({ role: 'backend', index: AGAIN, content: 'Repris après le QA' })
    expect(reports[0]?.index).toEqual(FIRST)
    expect(docs.listReports('T999')).toEqual([])
  })

  it('should_journal_per_project_and_globally', () => {
    docs.writeSpec('T002', 'po', 'Spec')
    docs.writeReport('T002', { id: 'back', role: 'backend' }, 'Rapport', FIRST)
    expect(docs.readProjectJournal()).toMatch(/T002 · po · Spec v1 signée\./)
    expect(docs.readProjectJournal()).toMatch(/T002 · backend · Rapport rendu \(back, passe 1 initiale\)\./)
    expect(docs.readGlobalJournal()).toMatch(/demo · T002 · backend · Rapport rendu \(back, passe 1 initiale\)\./)
  })

  it('should_condense_the_global_journal_and_keep_it_short', () => {
    const total = GLOBAL_JOURNAL_MAX_ENTRIES + 20
    for (let i = 0; i < total; i += 1) {
      docs.appendJournal({ at: clock + i, taskId: `T${i % 3}`, role: 'qa', message: `Étape ${i}\nsuite` })
    }
    const lines = entries(docs.readGlobalJournal())
    const condensed = lines.filter((l) => l.startsWith('- ~ '))
    expect(lines.length).toBeLessThanOrEqual(GLOBAL_JOURNAL_MAX_ENTRIES)
    expect(condensed.length).toBeGreaterThan(0)
    expect(lines.length - condensed.length).toBeGreaterThanOrEqual(GLOBAL_JOURNAL_KEEP_ENTRIES)
    const counted = condensed.reduce((n, l) => n + Number(/: (\d+) entrées/.exec(l)?.[1]), 0)
    expect(counted + (lines.length - condensed.length)).toBe(total)
    const projectJournal = readFileSync(join(root, 'projet', 'docs', 'pipeline', 'JOURNAL.md'), 'utf8')
    expect(entries(projectJournal)).toHaveLength(total)
  })
})
