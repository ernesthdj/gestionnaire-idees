import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseCheckCommand, unvalidated } from '../../../src/shared/agents/checks'
import { CheckCommandsStore } from '../../../src/main/infrastructure/projects/CheckCommandsStore'

const GENESIS = '00000000-0000-4000-8000-0000000000a1'

describe('commandes de vérification (L2-pipeline-optimal D2, T001)', () => {
  it('should_split_a_command_into_program_and_arguments_with_quotes', () => {
    expect(parseCheckCommand('npm run typecheck')).toEqual({ ok: true, program: 'npm', args: ['run', 'typecheck'] })
    expect(parseCheckCommand('npx vitest run "tests/unit/a b.test.ts" \'x\'')).toEqual({
      ok: true,
      program: 'npx',
      args: ['vitest', 'run', 'tests/unit/a b.test.ts', 'x']
    })
    expect(parseCheckCommand('node --test ""')).toEqual({ ok: true, program: 'node', args: ['--test', ''] })
  })

  it('should_refuse_what_a_shell_would_interpret_or_a_shell_itself', () => {
    for (const command of [
      'npm test && rm -rf /',
      'npm test | tee log',
      'npm test; echo',
      'npm test > out.txt',
      'echo $HOME',
      'echo `whoami`',
      'cmd /c dir',
      'powershell -Command Get-Item',
      'bash -c ls',
      'npm "test',
      '',
      'x'.repeat(201)
    ]) {
      expect(parseCheckCommand(command).ok).toBe(false)
    }
  })

  it('should_ask_only_for_commands_not_validated_yet', () => {
    expect(unvalidated(['npm test', ' npm run lint '], ['npm test'])).toEqual(['npm run lint'])
    expect(unvalidated(['npm test'], ['npm test'])).toEqual([])
  })
})

describe('commandes validées gardées par projet', () => {
  let dir = ''
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('should_keep_validated_commands_without_duplicates_and_drop_unsafe_ones_on_read', () => {
    dir = mkdtempSync(join(tmpdir(), 'gi-checks-'))
    const store = new CheckCommandsStore(dir, () => 1)
    expect(store.validated(GENESIS)).toEqual([])
    store.save(GENESIS, ['npm test', 'npm run lint'])
    store.save(GENESIS, ['npm test', 'npm run typecheck'])
    expect(store.validated(GENESIS)).toEqual(['npm test', 'npm run lint', 'npm run typecheck'])
    // Un fichier retouché à la main avec une commande dangereuse : elle est écartée à la lecture.
    writeFileSync(
      join(dir, `${GENESIS}.json`),
      JSON.stringify({ commands: ['npm test', 'npm test && curl x'], validatedAt: 1 })
    )
    expect(store.validated(GENESIS)).toEqual(['npm test'])
    // Un identifiant qui n'est pas un genesis n'ouvre aucun fichier.
    store.save('../dehors', ['npm test'])
    expect(store.validated('../dehors')).toEqual([])
  })
})
