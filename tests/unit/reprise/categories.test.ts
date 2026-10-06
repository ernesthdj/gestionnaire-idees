import { describe, expect, it } from 'vitest'
import { categorize, categorizeMember, type CategoryInput } from '../../../src/main/domain/reprise/categories'

const item = (path: string, name: string, extra: Partial<CategoryInput> = {}): CategoryInput => ({
  path,
  kind: 'class',
  name,
  bases: [],
  attributes: [],
  entry: false,
  ...extra
})

describe('catégories des éléments d’un projet repris (spec 017 R3)', () => {
  it.each([
    ['src/utils/logger.ts', 'log', 'plumbing'],
    ['Logging/AuditLog.cs', 'AuditLog', 'plumbing'],
    ['src/api/orderController.ts', 'OrderController', 'orchestration'],
    ['Controllers/OrdersController.cs', 'OrdersController', 'orchestration'],
    ['Program.cs', '<fichier>', 'orchestration'],
    ['routes/web.php', '<fichier>', 'orchestration'],
    ['src/infra/orderRepository.ts', 'OrderRepository', 'infrastructure'],
    ['Infrastructure/InvoiceRepository.cs', 'InvoiceRepository', 'infrastructure'],
    ['src/core/orderService.ts', 'OrderService', 'domain'],
    ['Domain/OrderService.cs', 'OrderService', 'domain']
  ])('should_put_%s_%s_in_%s', (path, name, category) => {
    expect(categorize(item(path, name)).category).toBe(category)
  })

  it('should_treat_an_eloquent_model_as_infrastructure_and_an_entry_point_as_orchestration', () => {
    expect(categorize(item('app/Models/Order.php', 'Order', { bases: ['Model'] })).category).toBe('infrastructure')
    expect(categorize(item('app/Services/Thing.php', 'Thing', { bases: ['Model'] })).category).toBe('infrastructure')
    expect(categorize(item('src/core/run.ts', 'run', { kind: 'function', entry: true })).category).toBe('orchestration')
    expect(categorize(item('Domain/X.cs', 'X', { attributes: ['ApiController'] })).category).toBe('orchestration')
  })

  it('should_give_a_member_the_category_of_its_class_unless_it_is_plumbing', () => {
    const service = categorize(item('src/core/orderService.ts', 'OrderService'))
    expect(categorizeMember(item('src/core/orderService.ts', 'place', { kind: 'method' }), service).category).toBe(
      'domain'
    )
    expect(categorizeMember(item('src/core/orderService.ts', 'log', { kind: 'method' }), service).category).toBe(
      'plumbing'
    )
    const controller = categorize(item('Controllers/OrdersController.cs', 'OrdersController'))
    expect(
      categorizeMember(item('Controllers/OrdersController.cs', 'Post', { kind: 'method' }), controller).category
    ).toBe('orchestration')
  })

  it('should_always_give_a_short_reason', () => {
    expect(categorize(item('src/core/x.ts', 'X')).reason).toBe('logique propre au projet (règles, calculs, décisions)')
  })
})
