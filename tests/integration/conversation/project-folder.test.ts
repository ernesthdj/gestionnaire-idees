import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { BrainstormRepository } from '../../../src/main/infrastructure/db/repositories/BrainstormRepository'
import { ConversationRepository } from '../../../src/main/infrastructure/db/repositories/ConversationRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('dossier du projet du canevas d’une conversation (spec 024 D19)', () => {
  let dir: string
  let handle: DatabaseHandle
  let brainstorms: BrainstormRepository
  let neurons: NeuronRepository
  let conversations: ConversationRepository

  const brainstorm = (folderPath: string | null): string =>
    brainstorms.insert({
      name: 'PID',
      slug: `pid-${randomUUID().slice(0, 8)}`,
      description: '',
      type: null,
      location: folderPath === null ? 'local' : 'external',
      origin: 'existing',
      folderPath,
      gitRole: 'none',
      github: false
    }).id

  const genesis = (brainstormId: string): string => {
    const id = randomUUID()
    neurons.insertRoot({ id, title: 'Idée', content: null, nature: 'reflection', natureSource: null, brainstormId })
    return id
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-project-folder-'))
    handle = openDatabase({ file: join(dir, 'g.db'), key: '9'.repeat(64), migrationsFolder: MIGRATIONS })
    brainstorms = new BrainstormRepository(handle.db)
    neurons = new NeuronRepository(handle.db)
    conversations = new ConversationRepository(handle.db)
  })
  afterEach(() => {
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should_give_every_genesis_of_a_canvas_its_project_folder_when_it_has_no_folder_of_its_own', () => {
    const canvas = brainstorm('C:/projets/PID')
    const first = genesis(canvas)
    const second = genesis(canvas)
    expect(conversations.neuron(first)?.projectFolder).toBe('C:/projets/PID')
    expect(conversations.neuron(second)).toMatchObject({ projectFolder: 'C:/projets/PID', projectDir: null })
  })

  it('should_give_the_steps_of_a_genesis_the_folder_of_its_canvas', () => {
    const owner = genesis(brainstorm('C:/projets/PID'))
    const step = randomUUID()
    new PlanRepository(handle.db).insertStep({
      id: step,
      genesisId: owner,
      parentId: owner,
      depth: 1,
      rank: 1,
      title: 'Étape',
      content: '',
      view: null
    })
    expect(conversations.neuron(step)?.projectFolder).toBe('C:/projets/PID')
  })

  it('should_give_each_genesis_the_folder_of_its_own_canvas_when_several_canvases_exist', () => {
    const pid = genesis(brainstorm('C:/projets/PID'))
    const other = genesis(brainstorm('C:/projets/autre'))
    const loose = genesis(brainstorm(null))
    expect(conversations.neuron(pid)?.projectFolder).toBe('C:/projets/PID')
    expect(conversations.neuron(other)?.projectFolder).toBe('C:/projets/autre')
    expect(conversations.neuron(loose)?.projectFolder).toBeNull()
  })

  it('should_give_no_project_folder_when_the_canvas_has_none', () => {
    expect(conversations.neuron(genesis(brainstorm(null)))?.projectFolder).toBeNull()
  })
})
