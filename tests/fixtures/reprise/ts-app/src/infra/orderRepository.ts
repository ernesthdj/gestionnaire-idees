const rows: { readonly total: number }[] = []

export class OrderRepository {
  save(order: { readonly total: number }): void {
    rows.push(order)
  }

  count(): number {
    return rows.length
  }
}
