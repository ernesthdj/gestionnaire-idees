using Microsoft.AspNetCore.Mvc;
using Shop.Domain;

namespace Shop.Controllers;

[ApiController]
[Route("orders")]
public class OrdersController : ControllerBase
{
    private readonly OrderService _service;

    public OrdersController(OrderService service)
    {
        _service = service;
    }

    [HttpPost]
    public IActionResult Post(OrderRequest request)
    {
        var total = _service.Place(request);
        return Ok(total);
    }
}
