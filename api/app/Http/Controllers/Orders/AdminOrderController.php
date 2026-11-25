<?php

namespace App\Http\Controllers\Orders;

use App\Actions\Notices\RecordOrderMail;
use App\Actions\Payments\RequestPaymentRefresh;
use App\Enums\OrderStatus;
use App\Http\Resources\Orders\OrderResource;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminOrderController
{
    private const PAGE_SIZE = 25;

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
            'shipping_method' => ['sometimes', Rule::in(['delivery', 'pickup'])],
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
            'date_from' => ['sometimes', 'date_format:Y-m-d'],
            'date_to' => ['sometimes', 'date_format:Y-m-d', ...($request->filled('date_from') ? ['after_or_equal:date_from'] : [])],
        ]);
        $stage = $filters['fulfilment_status'] ?? null;
        $query = Order::query()->commercial();
        foreach (['status', 'shipping_method'] as $key) {
            if (isset($filters[$key])) {
                $query->where($key, $filters[$key]);
            }
        }
        if ($stage === 'needs_preparation') {
            $query->whereIn('fulfilment_status', Order::PREPARATION_STAGES);
        } elseif ($stage !== null) {
            $query->where('fulfilment_status', $stage);
        }
        $timezone = config('store.timezone');
        if (isset($filters['date_from'])) {
            $query->where('created_at', '>=', CarbonImmutable::createFromFormat('!Y-m-d', $filters['date_from'], $timezone)->utc());
        }
        if (isset($filters['date_to'])) {
            $query->where('created_at', '<', CarbonImmutable::createFromFormat('!Y-m-d', $filters['date_to'], $timezone)->addDay()->utc());
        }
        $search = mb_strtolower($filters['q'] ?? '');
        if (preg_match('/\A[0-9a-f]{8}(?:-[0-9a-f-]*)?\z/', $search)) {
            // The conventional short ID is the first UUID group. Keep these lookups in SQL.
            $cast = in_array($query->getConnection()->getDriverName(), ['mysql', 'mariadb'], true) ? 'CHAR' : 'TEXT';
            $query->whereRaw("LOWER(CAST(reference AS {$cast})) LIKE ?", [$search.'%']);
            $search = '';
        }
        $orders = $search === ''
            ? $query->latest('id')->paginate(self::PAGE_SIZE)
            : $this->searchOrderContacts($query, $search, $request);

        return OrderResource::collection($orders->withQueryString())->response()->header('Cache-Control', 'private, no-store');
    }

    private function searchOrderContacts(Builder $query, string $search, Request $request): LengthAwarePaginator
    {
        $page = LengthAwarePaginator::resolveCurrentPage();
        $offset = ($page - 1) * self::PAGE_SIZE;
        $total = 0;
        $ids = [];
        // ponytail: scan the filtered encrypted snapshots in batches, not the current user profiles.
        // Exact totals cost O(n) decryptions; move to a privacy-reviewed search index if volume warrants it.
        foreach ((clone $query)->select('id', 'reference', 'contact')->lazyByIdDesc(128) as $candidate) {
            $contact = $candidate->contact;
            if (! str_contains(mb_strtolower($candidate->reference), $search)
                && ! str_contains(mb_strtolower($contact['name'] ?? ''), $search)
                && ! str_contains(mb_strtolower($contact['email'] ?? ''), $search)) {
                continue;
            }
            if ($total >= $offset && count($ids) < self::PAGE_SIZE) {
                $ids[] = $candidate->id;
            }
            $total++;
        }

        return new LengthAwarePaginator(
            $query->whereKey($ids)->latest('id')->get(), $total, self::PAGE_SIZE, $page, ['path' => $request->url()],
        );
    }

    public function show(string $reference, RequestPaymentRefresh $refresh): JsonResponse
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
        $canRequestRefresh = $refresh->isEligible($order);
        $payment = [
            'can_request_refresh' => $canRequestRefresh,
            'paid_at' => $order->paid_at?->toISOString(),
            'last_checked_at' => $order->payment_reconciled_at?->toISOString(),
            'next_check_at' => $canRequestRefresh ? $order->payment_reconcile_at?->toISOString() : null,
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

    public function fulfil(Request $request, string $reference, RecordOrderMail $notices): JsonResponse
    {
        $input = $request->validate([
            'status' => ['required', Rule::in(self::STAGES)],
            'tracking' => ['nullable', 'string', 'max:100', 'prohibited_unless:status,shipped'],
            'note' => ['nullable', 'string', 'max:800'],
        ]);
        $order = DB::transaction(function () use ($request, $reference, $input, $notices): Order {
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
            $occurredAt = now();
            DB::table('order_fulfilment_events')->insert([
                'order_id' => $order->id,
                'actor_id' => $request->user()->id,
                'to_status' => $expected,
                'note' => isset($input['note']) ? Crypt::encryptString($input['note']) : null,
                'created_at' => $occurredAt,
            ]);
            $notices->fulfilment($order, $expected, $occurredAt);

            return $order;
        }, 3);

        return OrderResource::make($order)->response()->header('Cache-Control', 'private, no-store');
    }
}
