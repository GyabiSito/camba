<?php

namespace App\Queries\Admin;

use App\Enums\OrderStatus;
use App\Http\Resources\Orders\OrderResource;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Models\Withdrawal;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

class DashboardSummary
{
    public function get(): array
    {
        $timezone = config('store.timezone');
        $now = Carbon::now($timezone)->toImmutable();
        $from = $now->startOfDay()->subDays(29);
        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $start = $now->startOfMonth()->subMonths($i);
            $months[] = [
                'month' => $start->format('Y-m'),
                ...$this->sales($start, $now, $start->addMonth()),
            ];
        }

        return [
            'priorities' => [
                'pending_payment' => Order::query()->where('status', OrderStatus::PendingPayment)->count(),
                'needs_preparation' => Order::query()->where('status', OrderStatus::Paid)
                    ->whereIn('fulfilment_status', Order::PREPARATION_STAGES)->count(),
                'ready_for_pickup' => Order::query()->where('status', OrderStatus::Paid)
                    ->where('fulfilment_status', 'ready_for_pickup')->count(),
                'out_of_stock' => Product::query()->published()->withoutAvailableStock()->count(),
                'received_withdrawals' => Withdrawal::query()->where('status', 'received')->count(),
                'registered_buyers' => User::query()->buyers()->count(),
            ],
            'recent_orders' => OrderResource::collection(Order::query()->latest('id')->limit(5)->get([
                'reference', 'status', 'currency', 'subtotal_cents', 'shipping_cents', 'total_cents',
                'shipping_method', 'fulfilment_status', 'reservation_expires_at', 'created_at',
            ]))->resolve(),
            'sales' => [
                'timezone' => $timezone,
                'from' => $from->toDateString(),
                'through' => $now->toDateString(),
                ...$this->sales($from, $now),
                'months' => $months,
            ],
        ];
    }

    private function sales(CarbonImmutable $from, CarbonImmutable $now, ?CarbonImmutable $until = null): array
    {
        $query = Order::query()->where('status', OrderStatus::Paid)
            ->where('paid_at', '>=', $from->utc())->where('paid_at', '<=', $now->utc());
        if ($until !== null) {
            $query->where('paid_at', '<', $until->utc());
        }
        $totals = $query->selectRaw('COUNT(*) AS order_count, COALESCE(SUM(total_cents), 0) AS total_cents')->first();

        return ['order_count' => (int) $totals->order_count, 'total_cents' => (int) $totals->total_cents];
    }
}
