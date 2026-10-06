<?php

namespace App\Services;

use App\Models\Order;

class OrderService
{
    public function calculateDiscount(float $total): float
    {
        return $total > 200 ? $total * 0.1 : 0;
    }

    public function place(float $price, int $quantity): Order
    {
        $total = $price * $quantity;
        return Order::create(['total' => $total - $this->calculateDiscount($total)]);
    }
}
