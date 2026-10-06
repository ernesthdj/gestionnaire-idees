import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GRAMMARS, loadEngine } from '../../../src/analysis-worker/engine'

const GRAMMARS_DIR = resolve(import.meta.dirname, '../../../node_modules/@vscode/tree-sitter-wasm/wasm')

describe('moteur d’analyse syntaxique (spec 017 R1)', () => {
  it('should_parse_typescript_csharp_and_php_without_running_anything', async () => {
    const engine = await loadEngine(GRAMMARS_DIR)
    expect(Object.keys(engine.languages).sort()).toEqual(Object.keys(GRAMMARS).sort())
    const samples = [
      ['ts', "import { a } from './a'\nexport function f() { a.b(1) }", '(call_expression function: (_) @fn)', 'a.b'],
      [
        'cs',
        'namespace N { class C { void M() { repo.Save(); } } }',
        '(invocation_expression function: (_) @fn)',
        'repo.Save'
      ],
      ['php', '<?php\nfunction f() { g(); }', '(function_call_expression function: (_) @fn)', 'g']
    ] as const
    for (const [lang, source, query, expected] of samples) {
      engine.parser.setLanguage(engine.languages[lang])
      const tree = engine.parser.parse(source)
      const captures = new engine.module.Query(engine.languages[lang], query).captures(tree?.rootNode ?? never())
      expect(captures.map((capture) => capture.node.text)).toEqual([expected])
    }
  })
})

function never(): never {
  throw new Error('arbre absent')
}
