import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadEngine, type Engine, type GrammarLang } from '../../../src/analysis-worker/engine'
import { DOC_MAX, extractFile, type FileExtraction } from '../../../src/analysis-worker/extract'

const GRAMMARS = resolve(import.meta.dirname, '../../../node_modules/@vscode/tree-sitter-wasm/wasm')
const FIXTURES = resolve(import.meta.dirname, '../../fixtures/reprise')

describe('extraction de la structure d’un fichier (spec 017 R3)', () => {
  let engine: Engine
  beforeAll(async () => {
    engine = await loadEngine(GRAMMARS)
  })

  const extract = (lang: GrammarLang, path: string): FileExtraction => {
    const result = extractFile(engine, lang, readFileSync(resolve(FIXTURES, path), 'utf8'))
    if (!result.ok) throw new Error(result.reason)
    return result.extraction
  }
  const calls = (extraction: FileExtraction): string[] =>
    extraction.calls.map(
      (call) => `${call.receiver === null ? '' : `${call.receiver}|`}${call.callee}${call.isNew ? ' (new)' : ''}`
    )

  it('should_extract_typescript_imports_classes_methods_calls_and_member_types', () => {
    const service = extract('ts', 'ts-app/src/core/orderService.ts')
    expect(service.imports).toEqual([
      {
        source: '../infra/orderRepository',
        names: [{ local: 'OrderRepository', imported: 'OrderRepository' }],
        line: 1
      }
    ])
    expect(service.symbols.map((symbol) => [symbol.kind, symbol.qualifiedName])).toEqual([
      ['interface', 'OrderInput'],
      ['function', 'calculateDiscount'],
      ['class', 'OrderService'],
      ['method', 'OrderService.place']
    ])
    expect(service.symbols.find((symbol) => symbol.name === 'OrderService')?.memberTypes).toEqual({
      repository: 'OrderRepository'
    })
    expect(calls(service)).toEqual(
      expect.arrayContaining(['OrderRepository (new)', 'calculateDiscount', 'this.repository|save'])
    )
    const controller = extract('ts', 'ts-app/src/api/orderController.ts')
    expect(controller.imports[0]?.source).toBe('@core/orderService')
    expect(calls(controller)).toEqual(expect.arrayContaining(['log', 'this.service|place']))
  })

  it('should_extract_csharp_namespaces_bases_injections_and_attributes', () => {
    const program = extract('cs', 'cs-app/Program.cs')
    expect(program.topLevelCode).toBe(true)
    expect(program.registrations).toEqual([
      { service: 'IOrderRepository', implementation: 'SqlOrderRepository' },
      { service: 'OrderService', implementation: 'OrderService' },
      { service: 'AuditLog', implementation: 'AuditLog' }
    ])
    const service = extract('cs', 'cs-app/Domain/OrderService.cs')
    expect(service.namespace).toBe('Shop.Domain')
    expect(service.symbols.map((symbol) => symbol.qualifiedName)).toEqual(
      expect.arrayContaining([
        'Shop.Domain.OrderService',
        'Shop.Domain.OrderService.Place',
        'Shop.Domain.IOrderRepository'
      ])
    )
    expect(
      service.symbols.find((symbol) => symbol.name === 'OrderService' && symbol.kind === 'class')?.memberTypes
    ).toEqual(expect.objectContaining({ _repository: 'IOrderRepository', repository: 'IOrderRepository' }))
    expect(calls(service)).toEqual(expect.arrayContaining(['_repository|Save', 'store|Save', 'Stores|Resolve']))
    const repository = extract('cs', 'cs-app/Infrastructure/SqlOrderRepository.cs')
    expect(repository.symbols[0]).toMatchObject({ name: 'SqlOrderRepository', bases: ['IOrderRepository'] })
    expect(extract('cs', 'cs-app/Controllers/OrdersController.cs').symbols[0]?.attributes).toEqual([
      'ApiController',
      'Route'
    ])
  })

  it('should_extract_laravel_routes_uses_and_static_calls', () => {
    const routes = extract('php', 'laravel-app/routes/web.php')
    expect(routes.routes).toEqual([
      { method: 'GET', path: '/orders', controller: 'OrderController', action: 'index', line: 6 },
      { method: 'POST', path: '/orders', controller: 'OrderController', action: 'store', line: 7 }
    ])
    expect(routes.imports.map((entry) => entry.source)).toEqual([
      'App\\Http\\Controllers\\OrderController',
      'Illuminate\\Support\\Facades\\Route'
    ])
    const controller = extract('php', 'laravel-app/app/Http/Controllers/OrderController.php')
    expect(controller.namespace).toBe('App.Http.Controllers')
    expect(controller.symbols[0]).toMatchObject({ name: 'OrderController', bases: ['Controller'] })
    expect(controller.symbols[0]?.memberTypes).toEqual({ service: 'OrderService' })
    expect(calls(controller)).toEqual(expect.arrayContaining(['Order|all', '$this->service|place']))
  })

  const fromSource = (lang: GrammarLang, source: string): FileExtraction => {
    const result = extractFile(engine, lang, source)
    if (!result.ok) throw new Error(result.reason)
    return result.extraction
  }
  const exported = (extraction: FileExtraction): Record<string, boolean> =>
    Object.fromEntries(extraction.symbols.map((symbol) => [symbol.qualifiedName, symbol.exported]))

  it('should_mark_exported_typescript_blocks_and_public_members_of_exported_classes_only', () => {
    const extraction = fromSource(
      'ts',
      [
        'export function a(): void {}',
        'function b(): void {}',
        'export const c = (): void => {}',
        'const d = (): void => {}',
        'export class E { run(): void {} private hide(): void {} protected keep(): void {} #secret(): void {} }',
        'class F { run(): void {} }',
        'export default function g(): void {}',
        'function h(): void {}',
        'export { h }'
      ].join('\n')
    )
    expect(exported(extraction)).toEqual({
      a: true,
      b: false,
      c: true,
      d: false,
      E: true,
      'E.run': true,
      'E.hide': false,
      'E.keep': false,
      'E.#secret': false,
      F: false,
      'F.run': false,
      g: true,
      h: true
    })
  })

  it('should_count_a_react_component_usage_as_a_call_and_ignore_html_tags', () => {
    const extraction = fromSource(
      'tsx',
      [
        'function Item(): JSX.Element { return <li /> }',
        'export function List(): JSX.Element {',
        '  return <ul><Item /><Ui.Badge>ok</Ui.Badge><div /></ul>',
        '}'
      ].join('\n')
    )
    expect(calls(extraction)).toEqual(['Item', 'Ui|Badge'])
    expect(extraction.calls[0]?.from).toBe(1)
  })

  it('should_mark_public_csharp_members_and_interface_members_as_exported', () => {
    const extraction = fromSource(
      'cs',
      [
        'namespace Shop;',
        'public class A { public void Run() {} private void Hide() {} void Default() {} }',
        'internal class B { public void Run() {} }',
        'public interface IC { void Do(); }'
      ].join('\n')
    )
    expect(exported(extraction)).toEqual({
      'Shop.A': true,
      'Shop.A.Run': true,
      'Shop.A.Hide': false,
      'Shop.A.Default': false,
      'Shop.B': false,
      'Shop.B.Run': false,
      'Shop.IC': true,
      'Shop.IC.Do': true
    })
  })

  it('should_mark_top_level_php_classes_functions_and_non_private_methods_as_exported', () => {
    const extraction = fromSource(
      'php',
      [
        '<?php',
        'function helper() {}',
        'class A {',
        '  public function run() {}',
        '  function implicit() {}',
        '  private function hide() {}',
        '  protected function keep() {}',
        '}'
      ].join('\n')
    )
    expect(exported(extraction)).toEqual({
      helper: true,
      A: true,
      'A.run': true,
      'A.implicit': true,
      'A.hide': false,
      'A.keep': false
    })
  })

  const docs = (extraction: FileExtraction): Record<string, string | null> =>
    Object.fromEntries(extraction.symbols.map((symbol) => [symbol.qualifiedName, symbol.doc]))

  it('should_take_the_first_sentence_of_the_comment_glued_above_a_typescript_block', () => {
    const extraction = fromSource(
      'ts',
      [
        '/**',
        ' * Range les cartes. Ensuite les compte.',
        ' * @param x ignoré',
        ' */',
        'export function ranger(): void {}',
        '// Commentaire éloigné.',
        '',
        'function seul(): void {}',
        '/** Fonction fléchée exportée */',
        'export const fleche = (): void => {}',
        'class Carte {',
        '  // Lit une carte.',
        '  lire(): void {}',
        '}'
      ].join('\n')
    )
    expect(docs(extraction)).toEqual({
      ranger: 'Range les cartes.',
      seul: null,
      fleche: 'Fonction fléchée exportée',
      Carte: null,
      'Carte.lire': 'Lit une carte.'
    })
  })

  it('should_read_csharp_xml_and_php_doc_comments_as_plain_text', () => {
    const cs = fromSource(
      'cs',
      [
        'namespace Shop;',
        '/// <summary>',
        '/// Passe une <b>commande</b>.',
        '/// </summary>',
        'public class Orders {}'
      ].join('\n')
    )
    expect(cs.symbols[0]?.doc).toBe('Passe une commande.')
    const php = fromSource('php', ['<?php', '/**', ' * Aide au rangement', ' */', 'function aide() {}'].join('\n'))
    expect(php.symbols[0]?.doc).toBe('Aide au rangement')
    const method = fromSource(
      'ts',
      ['/** Lit la **carte** du `nœud` (spec 023 D6, précisé) : vite (FR-012). */', 'function lire(): void {}'].join(
        '\n'
      )
    )
    expect(method.symbols[0]?.doc).toBe('Lit la carte du nœud : vite.')
    const long = fromSource('ts', [`// ${'mot '.repeat(80)}`, 'function f(): void {}'].join('\n'))
    expect(long.symbols[0]?.doc).toHaveLength(DOC_MAX)
    expect(long.symbols[0]?.doc?.endsWith('…')).toBe(true)
  })

  it('should_measure_branches_as_an_approximate_cyclomatic_complexity', () => {
    const service = extract('ts', 'ts-app/src/core/orderService.ts')
    expect(service.symbols.find((symbol) => symbol.name === 'calculateDiscount')?.complexity).toBe(2)
  })

  it('should_report_a_syntax_error_without_extracting', () => {
    const result = extractFile(engine, 'ts', readFileSync(resolve(FIXTURES, 'ts-app/src/broken.ts'), 'utf8'))
    expect(result).toMatchObject({ ok: false, reason: 'erreur de syntaxe' })
  })

  it('should_give_up_on_a_file_that_takes_too_long', () => {
    let clock = 0
    const result = extractFile(engine, 'ts', 'const a = 1\n'.repeat(20_000), () => (clock += 1000))
    expect(result).toMatchObject({ ok: false, reason: 'analyse trop longue (plus de 2 s)' })
  })
})
