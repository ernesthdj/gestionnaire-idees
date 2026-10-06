using Shop.Domain;

namespace Shop.Infrastructure;

public class SqlOrderRepository : IOrderRepository
{
    private readonly List<decimal> _rows = new();

    public void Save(decimal total)
    {
        _rows.Add(total);
    }
}
