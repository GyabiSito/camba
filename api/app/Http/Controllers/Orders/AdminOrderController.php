<?php

namespace App\Http\Controllers\Orders;

use App\Enums\OrderStatus;
use App\Http\Resources\Orders\OrderResource;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminOrderController
{
    private const STAGES = ['preparing', 'ready_for_pickup', 'shipped', 'completed'];

    private const PAYMENT_ISSUES = [
        'stock_release_conflict', 'provider_evidence_mismatch', 'conflicting_provider_timestamp', 'payment_reversed',
        'multiple_approved_payments', 'approval_after_order_closed', 'late_approval_without_stock',
    ];

    private const RECONCILIATION_RESULTS = ['verified', 'conflicting_evidence', 'provider_incomplete', 'provider_candidate_limit'];

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['sometimes', Rule::enum(OrderStatus::class)],
            'fulfilment_status' => ['sometimes', Rule::in(['unstarted', ...self::STAGES, 'needs_preparation'])],
        ]);
        $stage = $filters['fulfilment_status'] ?? null;
        unset($filters['fulfilment_status']);
        $query = Order::query()->where($filters);
        if ($stage === 'needs_preparation') {
            $query->whereIn('fulfilment_status', Order::PREPARATION_STAGES);
        } elseif ($stage !== null) {
            $query->where('fulfilment_status', $stage);
        }
        $orders = $query->latest('id')->paginate(25)->withQueryString();

        return OrderResource::collection($orders)->response()->header('Cache-Control', 'private, no-store');
    }

    public function show(string $reference): JsonResponse
    {
        $order = Order::query()->with('items')->where('reference', $reference)->firstOrFail();
        $events = DB::table('order_fulfilment_events')->where('order_id', $order->id)->orderByDesc('id')->get([
            'actor_id', 'to_status', 'note', 'created_at',
        ])->map(fn ($event) => [
            ...((array) $event), 'note' => $event->note === null ? null : Crypt::decryptString($event->note),
        ]);

        $attempt = PaymentAttempt::query()->where('order_id', $order->id)->first(['status', 'expires_at']);
        $payments = Payment::query()->where('order_id', $order->id)->orderByDesc('provider_updated_at')->orderByDesc('id')
            ->get(['id', 'status', 'amount_cents', 'provider_updated_at'])->map(fn (Payment $payment) => [
                'id' => $payment->id,
                'status' => $payment->status->value,
                'amount_cents' => $payment->amount_cents,
                'updated_at' => $payment->provider_updated_at,
            ]);
        $payment = [
            'paid_at' => $order->paid_at?->toISOString(),
            'last_checked_at' => $order->payment_reconciled_at?->toISOString(),
            'next_check_at' => $order->payment_reconcile_at?->toISOString(),
            'last_result' => in_array($order->payment_reconcile_result, self::RECONCILIATION_RESULTS, true)
                ? $order->payment_reconcile_result : null,
            'issues' => array_values(array_intersect($order->payment_issues ?? [], self::PAYMENT_ISSUES)),
            'attempt' => $attempt === null ? null : [
                'status' => $attempt->status->value,
                'expires_at' => $attempt->expires_at->toISOString(),
            ],
            'observations' => $payments,
        ];

        return OrderResource::make($order)->additional(['events' => $events, 'payment' => $payment])
            ->response()->header('Cache-Control', 'private, no-store');
    }

    public function fulfil(Request $request, string $reference): JsonResponse
    {
        $input = $request->validate([
            'status' => ['required', Rule::in(self::STAGES)],
            'tracking' => ['nullable', 'string', 'max:100', 'prohibited_unless:status,shipped'],
            'note' => ['nullable', 'string', 'max:800'],
        ]);
        $order = DB::transaction(function () use ($request, $reference, $input): Order {
            $order = Order::query()->where('reference', $reference)->lockForUpdate()->firstOrFail();
            abort_unless($order->status === OrderStatus::Paid, 409, 'Only paid orders can progress to fulfilment.');
            $expected = match ($order->fulfilment_status) {
                'unstarted' => 'preparing',
                'preparing' => $order->shipping_method === 'pickup' ? 'ready_for_pickup' : 'shipped',
                'ready_for_pickup', 'shipped' => 'completed',
                default => null,
            };
            abort_unless($expected === $input['status'], 409, 'That fulfilment transition is unavailable.');
            $order->fulfilment_status = $expected;
            if ($expected === 'shipped') {
                $order->tracking = $input['tracking'] ?? null;
            }
            $order->save();
            DB::table('order_fulfilment_events')->insert([
                'order_id' => $order->id,
                'actor_id' => $request->user()->id,
                'to_status' => $expected,
                'note' => isset($input['note']) ? Crypt::encryptString($input['note']) : null,
                'created_at' => now(),
            ]);

            return $order;
        }, 3);

        return OrderResource::make($order)->response()->header('Cache-Control', 'private, no-store');
    }
}
