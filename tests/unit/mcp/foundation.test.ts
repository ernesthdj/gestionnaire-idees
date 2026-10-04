import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { McpToken, readToken } from '../../../src/main/infrastructure/mcp/token'
import { pipeNameFor } from '../../../src/main/infrastructure/mcp/endpoint'
import { LineSplitter } from '../../../src/main/infrastructure/mcp/lineSplitter'
import { DessinerInput, MCP_TOOLS, NoeudModifierInput, RetirerInput } from '../../../src/shared/mcp/tools'

const ID = '0f8b2a52-6d1c-4f3e-9a7b-2c4d5e6f7a8b'

describe('schémas des outils du pont', () => {
  it('should_refuse_unknown_fields_when_validating_any_tool_input', () => {
    for (const tool of Object.values(MCP_TOOLS)) {
      expect(tool.input.safeParse({ inconnu: 1 }).success).toBe(false)
    }
  })

  it('should_accept_a_batch_with_local_keys_and_existing_ids', () => {
    const parsed = DessinerInput.safeParse({
      ancre: ID,
      cadre: { titre: 'Mariage' },
      noeuds: [
        { cle: 'a', titre: 'Prestataires' },
        { cle: 'b', titre: 'Photographe', parent: 'a', type: 'idee' },
        { cle: 'c', titre: 'Sous une idée existante', parent: ID }
      ],
      liens: [{ de: 'a', vers: ID, libelle: 'budget' }]
    })
    expect(parsed.success).toBe(true)
  })

  it('should_refuse_a_key_with_forbidden_characters', () => {
    expect(DessinerInput.safeParse({ noeuds: [{ cle: 'A B', titre: 'x' }] }).success).toBe(false)
  })

  it('should_refuse_an_empty_batch_and_a_title_over_200_characters', () => {
    expect(DessinerInput.safeParse({ noeuds: [] }).success).toBe(false)
    expect(DessinerInput.safeParse({ noeuds: [{ cle: 'a', titre: 'x'.repeat(201) }] }).success).toBe(false)
  })

  it('should_require_a_title_or_a_text_when_modifying', () => {
    expect(NoeudModifierInput.safeParse({ id: ID }).success).toBe(false)
    expect(NoeudModifierInput.safeParse({ id: ID, texte: 'nouveau' }).success).toBe(true)
  })

  it('should_cap_retire_at_200_ids', () => {
    expect(RetirerInput.safeParse({ ids: Array.from({ length: 201 }, () => ID) }).success).toBe(false)
  })
})

describe('point de rendez-vous', () => {
  it('should_give_a_stable_pipe_name_per_profile_and_distinct_names_between_profiles', () => {
    const real = pipeNameFor('C:\\Users\\x\\AppData\\Roaming\\gestionnaire-idees')
    expect(pipeNameFor('C:\\Users\\x\\AppData\\Roaming\\gestionnaire-idees')).toBe(real)
    expect(pipeNameFor('C:\\Users\\x\\AppData\\Roaming\\gestionnaire-idees-demo')).not.toBe(real)
    expect(real).toMatch(/^\\\\\.\\pipe\\gestionnaire-idees-mcp-[0-9a-f]{8}$/)
  })

  it('should_give_the_same_pipe_whatever_the_separators_or_case_of_the_profile_path', () => {
    expect(pipeNameFor('C:/Users/x/AppData/Roaming/gestionnaire-idees-demo')).toBe(
      pipeNameFor('c:\\users\\x\\appdata\\roaming\\gestionnaire-idees-demo')
    )
  })
})

describe('secret du pont', () => {
  let dir: string
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'gi-token-'))))
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('should_create_a_64_hex_secret_on_first_start_and_reread_the_same_one', () => {
    const file = join(dir, 'mcp.token')
    const first = new McpToken(file).value()
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(new McpToken(file).value()).toBe(first)
    expect(readToken(file)).toBe(first)
  })

  it('should_refuse_the_old_secret_when_rotated', () => {
    const token = new McpToken(join(dir, 'mcp.token'))
    const old = token.value()
    const fresh = token.rotate()
    expect(fresh).not.toBe(old)
    expect(token.matches(old)).toBe(false)
    expect(token.matches(fresh)).toBe(true)
    expect(token.matches('court')).toBe(false)
  })

  it('should_replace_a_corrupted_secret_file', () => {
    const file = join(dir, 'mcp.token')
    writeFileSync(file, 'pas un secret')
    expect(readToken(file)).toBeUndefined()
    expect(new McpToken(file).value()).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('découpage des trames', () => {
  it('should_return_complete_lines_and_keep_the_partial_one', () => {
    const splitter = new LineSplitter(100)
    expect(splitter.push('{"a":1}\n{"b"')).toEqual({ lines: ['{"a":1}'], overflow: false })
    expect(splitter.push(':2}\r\n')).toEqual({ lines: ['{"b":2}'], overflow: false })
  })

  it('should_signal_an_overflow_when_a_line_exceeds_the_limit', () => {
    expect(new LineSplitter(10).push('x'.repeat(11)).overflow).toBe(true)
  })
})
