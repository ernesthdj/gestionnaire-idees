import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DocumentService } from '../../../src/main/application/documents/DocumentService'
import { DocumentTools } from '../../../src/main/application/mcp/DocumentTools'
import { NeuronTools } from '../../../src/main/application/mcp/NeuronTools'
import { toMcpError } from '../../../src/main/domain/mcp/errors'
import { ConversationRepository } from '../../../src/main/infrastructure/db/repositories/ConversationRepository'
import { DocumentRepository } from '../../../src/main/infrastructure/db/repositories/DocumentRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { DocumentFiles } from '../../../src/main/infrastructure/documents/DocumentFiles'
import { DocumentEcrireInput, MCP_TOOLS } from '../../../src/shared/mcp/tools'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('outils MCP document_ecrire et document_lire (spec 012 US1)', () => {
  let t: NeuronHarness
  let root: string
  let tools: DocumentTools
  let repository: DocumentRepository
  let written: { batchId: string; summary: string }[]
  let studio: string
  let other: string

  beforeEach(async () => {
    t = createNeuronHarness()
    root = mkdtempSync(join(tmpdir(), 'gi-doctools-'))
    mkdirSync(join(root, 'profil'))
    repository = new DocumentRepository(t.handle.db)
    const conversations = new ConversationRepository(t.handle.db)
    written = []
    tools = new DocumentTools({
      documents: new DocumentService({
        repository,
        files: new DocumentFiles({ profileDir: join(root, 'profil') }),
        nodes: new PlanRepository(t.handle.db),
        projectDir: () => null
      }),
      repository,
      conversations,
      onWritten: (event) => written.push(event)
    })
    studio = (await t.neurons.create({ text: 'Ouvrir un studio photo' })).id
    other = (await t.neurons.create({ text: 'Acheter un 70-200' })).id
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  const write = (args: unknown, neuronId: string | null = studio) =>
    tools.write(DocumentEcrireInput.parse(args), { neuronId })
  const file = (name: string) => readFileSync(join(root, 'profil', 'documents', name), 'utf8')

  it('should_create_a_document_for_the_conversation_neuron_and_announce_an_undoable_write', () => {
    const result = write({ titre: 'Cahier des charges', contenu: '# Cahier\n\n## Objectif' })
    expect(result.text).toContain('documents/cahier-des-charges.md')
    expect(file('cahier-des-charges.md')).toBe('# Cahier\n\n## Objectif')
    expect(repository.ofNeuron(studio)).toHaveLength(1)
    expect(written[0]?.summary).toBe('Claude : document « Cahier des charges » pour « Ouvrir un studio photo »')
  })

  it('should_complete_an_existing_document_and_read_it_back', () => {
    const { data } = write({ titre: 'Plan', contenu: 'Partie 1' })
    const documentId = (data as { document: string }).document
    write({ titre: 'Plan', document: documentId, contenu: 'Partie 2', mode: 'ajouter' })
    expect(file('plan.md')).toBe('Partie 1\n\nPartie 2')
    expect(tools.read(documentId, { neuronId: studio }).text).toContain('Partie 1\n\nPartie 2')
  })

  it('should_refuse_to_write_or_read_a_document_of_another_tree', () => {
    const { data } = write({ titre: 'Plan', contenu: 'x' })
    const documentId = (data as { document: string }).document
    expect(() => write({ titre: 'x', document: documentId, contenu: 'y' }, other)).toThrow(
      expect.objectContaining({ code: 'NON_MODIFIABLE' })
    )
    expect(() => tools.read(documentId, { neuronId: other })).toThrow(
      expect.objectContaining({ code: 'NON_MODIFIABLE' })
    )
    expect(() => write({ id: other, titre: 'x', contenu: 'y' })).toThrow(
      expect.objectContaining({ code: 'NON_MODIFIABLE' })
    )
  })

  it('should_refuse_a_document_over_500_ko_with_a_clear_code', () => {
    expect(DocumentEcrireInput.safeParse({ titre: 'x', contenu: 'a'.repeat(500 * 1024 + 1) }).success).toBe(false)
    let caught: unknown
    try {
      write({ titre: 'Gros', contenu: 'é'.repeat(300 * 1024) })
    } catch (error) {
      caught = error
    }
    expect(toMcpError(caught)?.code).toBe('LOT_TROP_GROS')
  })

  it('should_list_the_documents_of_a_node_in_neurone_contexte', () => {
    write({ titre: 'Plan', contenu: 'x' })
    const conversations = new ConversationRepository(t.handle.db)
    const neuronTools = new NeuronTools({
      conversations,
      insertAssessment: () => undefined,
      onChanged: () => undefined,
      documents: repository
    })
    expect(neuronTools.context(undefined, { neuronId: studio }).text).toMatch(
      /Documents :\n- « Plan » \[.+\] \(documents\/plan\.md\)/
    )
  })

  it('should_describe_the_tools_so_that_claude_uses_them_for_documents', () => {
    expect(MCP_TOOLS.document_ecrire.description).toContain('UN neurone')
    expect(MCP_TOOLS.dessiner.description).not.toContain('document')
  })
})
