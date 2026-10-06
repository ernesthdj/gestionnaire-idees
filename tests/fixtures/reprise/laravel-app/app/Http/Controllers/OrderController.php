<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(private OrderService $service)
    {
    }

    public function index()
    {
        return Order::all();
    }

    public function store(Request $request)
    {
        return $this->service->place($request->input('price'), $request->input('quantity'));
    }
}
