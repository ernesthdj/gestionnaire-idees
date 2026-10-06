namespace Shop.Logging;

public class AuditLog
{
    public void Save(decimal value)
    {
        Console.WriteLine($"audit {value}");
    }
}
