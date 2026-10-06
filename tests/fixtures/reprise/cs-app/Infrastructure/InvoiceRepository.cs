namespace Shop.Infrastructure;

public class InvoiceRepository
{
    private readonly List<decimal> _invoices = new();

    public void Save(decimal amount)
    {
        _invoices.Add(amount);
    }
}
