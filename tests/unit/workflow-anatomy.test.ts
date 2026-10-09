import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadEngine, type Engine, type GrammarLang } from '../../src/analysis-worker/engine'
import { extractFile, type FileExtraction } from '../../src/analysis-worker/extract'
import { ANATOMY_LIMITS, fileAnatomy } from '../../src/main/domain/workflow/anatomy'

const GRAMMARS = resolve(import.meta.dirname, '../../node_modules/@vscode/tree-sitter-wasm/wasm')

describe('anatomie d’un fichier (spec 023 D14, R12)', () => {
  let engine: Engine
  beforeAll(async () => {
    engine = await loadEngine(GRAMMARS)
  })

  const extract = (lang: GrammarLang, source: string): FileExtraction => {
    const result = extractFile(engine, lang, source)
    if (!result.ok) throw new Error(result.reason)
    return result.extraction
  }
  const anatomyOf = (lang: GrammarLang, lines: readonly string[]) => fileAnatomy(extract(lang, lines.join('\n')))
  const names = (anatomy: ReturnType<typeof fileAnatomy>, ids: readonly number[]): string[] =>
    ids.map((id) => anatomy.blocks.find((block) => block.id === id)?.name ?? '?')
  const edges = (anatomy: ReturnType<typeof fileAnatomy>): string[] =>
    anatomy.calls.map((call) => `${names(anatomy, [call.from])[0]}>${names(anatomy, [call.to])[0]}`)
  const unused = (anatomy: ReturnType<typeof fileAnatomy>): string[] =>
    anatomy.blocks.filter((block) => block.maybeUnused).map((block) => block.name)

  it('should_link_direct_self_and_new_calls_between_blocks_of_the_file_only', () => {
    const anatomy = anatomyOf('ts', [
      "import { save } from './store'",
      "import type { Row } from './store'",
      "import { log } from '../log'",
      'export function main(): void { prepare(); new Engine().start(); save(); other.prepare() }',
      'function prepare(): void { log() }',
      'class Engine { start(): void { this.step() } step(): void {} }'
    ])
    expect(edges(anatomy)).toEqual(['main>prepare', 'main>Engine', 'start>step'])
    expect(anatomy.imports).toEqual([
      { source: './store', names: 2, line: 1 },
      { source: '../log', names: 1, line: 3 }
    ])
    expect(anatomy.blocks.find((block) => block.name === 'step')).toMatchObject({ parent: 2, kind: 'method' })
    expect(anatomy.truncated).toBe(false)
  })

  it('should_flag_blocks_neither_offered_nor_called_as_maybe_unused', () => {
    const anatomy = anatomyOf('tsx', [
      'export function Page(): JSX.Element { return <Card /> }',
      'function Card(): JSX.Element { return <div /> }',
      'function orphan(): void { orphan() }',
      'function viaInstance(): void { new Tool().use() }',
      'class Tool { constructor() {} use(): void {} idle(): void {} }',
      'interface Shape { area(): number }'
    ])
    // Composant utilisé en JSX, méthode appelée sur une instance, constructeur, interface : jamais grisés.
    // Récursion seule (orphan) et méthode jamais appelée (idle) : grisées ; viaInstance n'est appelée par personne.
    expect(unused(anatomy)).toEqual(['orphan', 'viaInstance', 'idle'])
  })

  it('should_keep_a_class_useful_when_one_of_its_members_is_used_but_not_because_of_its_constructor', () => {
    const anatomy = anatomyOf('ts', [
      'class Used { constructor() {} run(): void {} }',
      'class Lonely { constructor() {} }',
      'export function go(x: Used): void { x.run() }'
    ])
    expect(unused(anatomy)).toEqual(['Lonely'])
  })

  it('should_mark_a_call_ambiguous_and_link_each_block_when_several_share_its_name', () => {
    const anatomy = anatomyOf('php', [
      '<?php',
      'class A { public function run() { $this->save(); } private function save() {} }',
      'class B { private function save() {} }'
    ])
    expect(edges(anatomy)).toEqual(['run>save', 'run>save'])
    expect(anatomy.calls.every((call) => call.ambiguous)).toBe(true)
  })

  it('should_not_flag_a_local_function_passed_as_a_value_inside_a_component', () => {
    const anatomy = anatomyOf('tsx', [
      'export function Panel(): JSX.Element {',
      '  const choose = (): void => {}',
      '  return <button onClick={choose} />',
      '}',
      'function lost(): void {}'
    ])
    expect(unused(anatomy)).toEqual(['lost'])
  })

  it('should_keep_recursion_as_a_self_call', () => {
    const anatomy = anatomyOf('ts', ['export function walk(n: number): void { if (n > 0) walk(n - 1) }'])
    expect(edges(anatomy)).toEqual(['walk>walk'])
    expect(unused(anatomy)).toEqual([])
  })

  it('should_link_csharp_static_and_this_calls_and_skip_namespaces', () => {
    const anatomy = anatomyOf('cs', [
      'namespace Shop;',
      'public class Orders {',
      '  public void Place() { Check(); this.Save(); }',
      '  private void Check() {}',
      '  private void Save() {}',
      '  private void Dead() {}',
      '}'
    ])
    expect(anatomy.blocks.map((block) => block.kind)).not.toContain('namespace')
    expect(edges(anatomy)).toEqual(['Place>Check', 'Place>Save'])
    expect(unused(anatomy)).toEqual(['Dead'])
  })

  it('should_cut_and_say_so_when_a_file_has_too_many_blocks', () => {
    const anatomy = anatomyOf(
      'ts',
      Array.from({ length: ANATOMY_LIMITS.blocks + 3 }, (_, index) => `export function f${index}(): void {}`)
    )
    expect(anatomy.blocks).toHaveLength(ANATOMY_LIMITS.blocks)
    expect(anatomy.truncated).toBe(true)
  })
})
