import { beforeAll, describe, expect, it } from 'vitest'
import { loadEngine, type Engine } from '../../../src/analysis-worker/engine'
import { resolveGraph, type ResolvedEdge } from '../../../src/main/domain/reprise/resolve'
import { extractFixture, FIXTURE_CONFIG, GRAMMARS_DIR } from '../../support/reprise'

/** Nom court d'un symbole : sans chemin ni namespace (`Shop.Domain.`, `App.Http.Controllers.`…). */
const short = (id: string | null): string =>
  id === null
    ? '?'
    : id.replace(/^.*#/, '').replace(/^(Shop\.\w+|App\.Http\.Controllers|App\.Models|App\.Services)\./, '')
const sure = (edges: readonly ResolvedEdge[]): string[] =>
  edges
    .filter((edge) => edge.provenance === 'syntax')
    .map((edge) => `${edge.kind} ${short(edge.fromSymbolId)} → ${short(edge.toSymbolId)}`)
    .sort()

describe('résolution des liens d’un projet repris (spec 017 R3, SC-006)', () => {
  let engine: Engine
  beforeAll(async () => {
    engine = await loadEngine(GRAMMARS_DIR)
  })

  it('should_resolve_exactly_the_sure_links_of_the_typescript_project', () => {
    const { edges, entries } = resolveGraph(extractFixture(engine, 'ts-app'), FIXTURE_CONFIG)
    expect(sure(edges)).toEqual([
      'call <fichier> → main',
      'call OrderController → OrderService',
      'call OrderController.post → OrderService.place',
      'call OrderController.post → log',
      'call OrderService → OrderRepository',
      'call OrderService.place → OrderRepository.save',
      'call OrderService.place → calculateDiscount',
      'call main → OrderController',
      'call main → log',
      'import <fichier> → OrderController',
      'import <fichier> → OrderInput',
      'import <fichier> → OrderRepository',
      'import <fichier> → OrderService',
      'import <fichier> → log',
      'import <fichier> → log'
    ])
    // `controller.post()` : variable sans type connu → déduction par le nom, jamais sûre.
    expect(edges.find((edge) => edge.rawTarget === 'controller.post')).toMatchObject({
      provenance: 'uncertain',
      toSymbolId: 'src/api/orderController.ts#OrderController.post'
    })
    expect(entries.map((entry) => [entry.kind, entry.label])).toEqual([['main', 'main.ts']])
  })

  it('should_resolve_exactly_the_sure_links_of_the_csharp_project_and_leave_save_ambiguous', () => {
    const { edges, entries } = resolveGraph(extractFixture(engine, 'cs-app'), FIXTURE_CONFIG)
    expect(sure(edges)).toEqual([
      'call OrderService.Archive → Stores.Resolve',
      'call OrderService.Place → OrderService.Archive',
      'call OrderService.Place → OrderService.CalculateDiscount',
      'call OrderService.Place → SqlOrderRepository.Save',
      'call OrdersController.Post → OrderService.Place',
      'implements SqlOrderRepository → IOrderRepository',
      'injects <fichier> → AuditLog',
      'injects <fichier> → OrderService',
      'injects <fichier> → SqlOrderRepository'
    ])
    const ambiguous = edges.find((edge) => edge.rawTarget === 'store.Save')
    expect(ambiguous).toMatchObject({ provenance: 'uncertain', toSymbolId: null })
    expect(ambiguous?.candidates.map(short).sort()).toEqual([
      'AuditLog.Save',
      'IOrderRepository.Save',
      'InvoiceRepository.Save',
      'SqlOrderRepository.Save'
    ])
    expect(entries.map((entry) => [entry.kind, entry.label]).sort()).toEqual([
      ['http_route', 'POST orders'],
      ['main', 'Program.cs']
    ])
  })

  it('should_resolve_laravel_routes_controllers_services_and_models', () => {
    const { edges, entries } = resolveGraph(extractFixture(engine, 'laravel-app'), FIXTURE_CONFIG)
    expect(sure(edges)).toEqual([
      'call OrderController.index → Order',
      'call OrderController.store → OrderService.place',
      'call OrderService.place → Order',
      'call OrderService.place → OrderService.calculateDiscount',
      'implements OrderController → Controller',
      'import <fichier> → Order',
      'import <fichier> → Order',
      'import <fichier> → OrderController',
      'import <fichier> → OrderService',
      'route <fichier> → OrderController.index',
      'route <fichier> → OrderController.store'
    ])
    expect(entries.map((entry) => entry.label).sort()).toEqual(['GET /orders', 'POST /orders'])
  })
})
