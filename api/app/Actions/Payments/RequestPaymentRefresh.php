<?php

namespace App\Actions\Payments;

use App\Models\Order;
use Illuminate\Database\Eloquent\Builder;

class RequestPaymentRefresh
{
    public function execute(Order $order): void
    {
        Order::query()->whereKey($order->id)->whereNull('payment_reconcile_at')
            ->where(function (Builder $available): void {
                $available->whereNull('payment_reconciled_at')->orWhere('payment_reconciled_at', '<=', now()->subMinute());
            })->update(['payment_reconcile_at' => now()]);
    }
}
