import { OrderRepository } from '../infra/orderRepository'

export interface OrderInput {
  readonly items: readonly { readonly price: number; readonly quantity: number }[]
}

export function calculateDiscount(total: number): number {
  return total > 200 ? total * 0.1 : 0
}

export class OrderService {
  private readonly repository = new OrderRepository()

  place(input: OrderInput): number {
    const total = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const due = total - calculateDiscount(total)
    this.repository.save({ total: due })
    return due
  }
}
