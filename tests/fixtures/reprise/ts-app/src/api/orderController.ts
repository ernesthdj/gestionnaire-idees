import { OrderService, type OrderInput } from '@core/orderService'
import { log } from '../utils/logger'

export class OrderController {
  private readonly service = new OrderService()

  post(input: OrderInput): number {
    log('commande reçue')
    return this.service.place(input)
  }
}
