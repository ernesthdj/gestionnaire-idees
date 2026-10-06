namespace Shop.Domain;

public record OrderRequest(decimal Price, int Quantity);

public interface IOrderRepository
{
    void Save(decimal total);
}

public class OrderService
{
    private readonly IOrderRepository _repository;

    public OrderService(IOrderRepository repository)
    {
        _repository = repository;
    }

    public decimal CalculateDiscount(decimal total) => total > 200 ? total * 0.1m : 0;

    public decimal Place(OrderRequest request)
    {
        var total = request.Price * request.Quantity;
        var due = total - CalculateDiscount(total);
        _repository.Save(due);
        Archive(due);
        return due;
    }

    // Cible inconnue sans typage : trois classes ont une méthode Save (appel ambigu, spec 017 US6).
    private static void Archive(decimal due)
    {
        var store = Stores.Resolve();
        store.Save(due);
    }
}
