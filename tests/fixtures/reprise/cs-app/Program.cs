using Shop.Domain;
using Shop.Infrastructure;
using Shop.Logging;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddScoped<IOrderRepository, SqlOrderRepository>();
builder.Services.AddScoped<OrderService>();
builder.Services.AddSingleton<AuditLog>();

var app = builder.Build();
app.MapControllers();
app.Run();
