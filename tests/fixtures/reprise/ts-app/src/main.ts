import { OrderController } from './api/orderController'
import { log } from './utils/logger'

export function main(): void {
  const controller = new OrderController()
  log('démarrage')
  controller.post({ items: [{ price: 120, quantity: 2 }] })
}

main()
