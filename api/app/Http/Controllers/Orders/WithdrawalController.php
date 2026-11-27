<?php

namespace App\Http\Controllers\Orders;

use App\Actions\Notices\NoticeEligibility;
use App\Actions\Notices\RecordRefundEffects;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\CommerceNotice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Withdrawal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class WithdrawalController
{
    public function store(Request $request, NoticeEligibility $eligibility): JsonResponse
    {
        $this->ensureReady();
        $fields = $request->validate([
            'order_reference' => ['required', 'uuid'],
            'email' => ['required', 'string', 'email', 'max:254'],
        ]);
        $reference = Str::lower($fields['order_reference']);
        $email = Str::lower(trim($fields['email']));

        $record = DB::transaction(function () use ($reference, $email, $eligibility): Withdrawal {
            $order = Order::query()->where('reference', $reference)->first();
            $matches = Withdrawal::purchaseMatches($order, $reference, $email);
            $withdrawal = Withdrawal::query()->createOrFirst([
                'request_key' => hash_hmac('sha256', "$reference|$email", config('app.key')),
            ], [
                'reference' => (string) Str::uuid(), 'order_reference' => $reference,
                'email' => $email, 'order_id' => $matches ? $order->id : null,
            ]);
            if ($matches && (int) $withdrawal->order_id === (int) $order->id) {
                CommerceNotice::query()->createOrFirst([
                    'dedup_key' => 'mail:withdrawal_receipt:'.$withdrawal->id,
                ], [
                    'channel' => 'mail', 'kind' => CommerceNotice::WITHDRAWAL_RECEIPT,
                    'subject_type' => 'withdrawal', 'subject_id' => $withdrawal->id,
                    'source_at' => $withdrawal->created_at, 'state' => 'pending', 'available_at' => now(),
                ]);
            }
            if ($withdrawal->wasRecentlyCreated) {
                CommerceNotice::query()->createOrFirst([
                    'dedup_key' => 'mail:'.CommerceNotice::ADMIN_WITHDRAWAL_RECEIVED.':'.$withdrawal->id,
                ], [
                    'channel' => 'mail', 'kind' => CommerceNotice::ADMIN_WITHDRAWAL_RECEIVED,
                    'subject_type' => 'withdrawal', 'subject_id' => $withdrawal->id,
                    'source_at' => $withdrawal->created_at, 'state' => 'pending', 'available_at' => now(),
                    ...$eligibility->administratorBinding(),
                ]);
            }

            return $withdrawal;
        }, 3);

        return response()->json(['data' => [
            'reference' => $record->reference, 'received_at' => $record->created_at->toISOString(),
        ]], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureReady();
        $filters = $request->validate([
            'status' => ['sometimes', 'required', 'string', 'in:received,reviewing,closed,refunded'],
            'reference' => ['sometimes', 'required', 'uuid'],
        ]);
        $page = Withdrawal::query()->with('order:id,reference,contact')
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($filters['reference'] ?? null, fn ($query, $reference) => $query->where('reference', $reference))
            ->latest('id')->paginate(25)->through($this->forAdmin(...));

        return response()->json([
            'data' => $page->items(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ])->header('Cache-Control', 'no-store');
    }

    public function update(Request $request, string $reference, RecordRefundEffects $refunds): JsonResponse
    {
        $this->ensureReady();
        $action = $request->validate(['action' => ['required', 'in:review,link_order,close,confirm_refund']])['action'];
        $record = DB::transaction(function () use ($action, $reference, $request, $refunds): Withdrawal {
            $case = Withdrawal::query()->where('reference', $reference)->lockForUpdate()->firstOrFail();
            $wasClosed = $case->status === 'closed';
            abort_if(
                ($case->status === 'closed' && ! in_array($action, ['close', 'confirm_refund'], true))
                || ($case->status === 'refunded' && $action !== 'confirm_refund'),
                409, 'La solicitud ya se cerró. Actualizá la lista para ver el estado actual.',
            );
            $order = null;
            if (in_array($action, ['link_order', 'confirm_refund'], true)) {
                $order = Order::query()->lockForUpdate()->find($case->order_id);
                abort_unless(Withdrawal::purchaseMatches($order, $case->order_reference, $case->email), 409,
                    'Los datos de la solicitud no coinciden con la compra.');
            }
            if (match ($action) {
                'review' => $case->status === 'reviewing',
                'link_order' => true,
                'close' => $case->status === 'closed',
                'confirm_refund' => $case->status === 'refunded',
            }) {
                return $case;
            }
            $changes = ['handled_by' => $request->user()->id];
            if ($action === 'confirm_refund') {
                $payment = $order?->paid_provider_payment_id === null ? null : Payment::query()
                    ->where('order_id', $order->id)->where('provider_payment_id', $order->paid_provider_payment_id)
                    ->where('status', PaymentStatus::Refunded)
                    ->where('amount_cents', $order->total_cents)->first();
                abort_unless($order?->status === OrderStatus::Refunded && $payment, 409, 'Todavía no hay un reintegro total verificado para este pedido.');
                $changes += [
                    'status' => 'refunded', 'refund_payment_id' => $payment->id,
                    'refund_provider_reference' => $payment->provider_payment_id, 'refund_confirmed_at' => now(),
                ];
            } else {
                $changes['status'] = $action === 'review' ? 'reviewing' : 'closed';
            }
            $case->forceFill($changes)->save();
            if ($action === 'confirm_refund' && ! $wasClosed) {
                $refunds->withdrawalClosed($case);
            }

            return $case;
        }, 3);

        return response()->json(['data' => $this->forAdmin($record)])->header('Cache-Control', 'no-store');
    }

    private function ensureReady(): void
    {
        abort_if(app()->isLocal() && ! Schema::hasTable('withdrawals'), 503, 'El registro no está disponible en este entorno. Usá Contactanos para dejar constancia.');
    }

    private function forAdmin(Withdrawal $case): array
    {
        return [
            'reference' => $case->reference,
            'order_reference' => $case->order_reference,
            'order_matched' => $case->verifiedOrder() !== null,
            'email' => $case->email,
            'status' => $case->status,
            'received_at' => $case->created_at->toISOString(),
            'refund_reference' => $case->refund_provider_reference,
            'refund_confirmed_at' => $case->refund_confirmed_at?->toISOString(),
        ];
    }
}
