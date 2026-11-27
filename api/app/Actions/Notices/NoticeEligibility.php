<?php

namespace App\Actions\Notices;

use App\Commerce\WithdrawalOwnerConfirmation;
use App\Mail\TransactionalEmail;
use App\Models\BuyerReminderPreference;
use App\Models\Cart;
use App\Models\CommerceNotice;
use App\Models\Order;
use App\Models\StoreSettings;
use App\Models\User;
use App\Models\Withdrawal;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class NoticeEligibility
{
    public const MAIL_WINDOW_DAYS = 7;

    public const PENDING_FULFILMENT = ['unstarted', 'preparing', 'ready_for_pickup'];

    private const FULFILMENT = [
        'order_ready_for_pickup' => 'ready_for_pickup', 'order_shipped' => 'shipped',
        CommerceNotice::ORDER_DELIVERED => 'completed',
    ];

    public function recipient(CommerceNotice $notice): ?array
    {
        if ($notice->kind === CommerceNotice::WITHDRAWAL_RECEIPT) {
            $case = Withdrawal::query()->find($notice->subject_id);

            return $case && Withdrawal::purchaseMatches($case->order, $case->order_reference, $case->email)
                && filter_var($case->email, FILTER_VALIDATE_EMAIL)
                ? [$case->email, null, $case->reference] : null;
        }
        if ($notice->kind === CommerceNotice::WITHDRAWAL_OWNER_CONFIRMATION) {
            $case = Withdrawal::query()->find($notice->subject_id);
            $buyer = $case ? WithdrawalOwnerConfirmation::activeRecipient($case, $case->requestedOrder) : null;

            return $buyer && hash_equals($notice->dedup_key, WithdrawalOwnerConfirmation::noticeKey($case))
                ? [$buyer->email, null, $case->reference, 'confirmation_url' => TransactionalEmail::withdrawalConfirmationUrl($case)] : null;
        }
        if ($notice->kind === CommerceNotice::ADMIN_WITHDRAWAL_RECEIVED) {
            $admin = $this->boundAdministrator($notice);
            $reference = Withdrawal::query()->whereKey($notice->subject_id)->value('reference');

            return $admin && $reference && TransactionalEmail::adminWithdrawalUrl($reference) !== null
                ? [$admin->email, null, $reference] : null;
        }
        if ($notice->kind === CommerceNotice::BUYER_WITHDRAWAL_RESOLVED) {
            $case = Withdrawal::query()->find($notice->subject_id);
            $order = $case?->status === 'refunded' ? $case->verifiedOrder() : null;
            $buyer = $this->buyer($order?->user_id);

            return $buyer && filter_var($buyer->email, FILTER_VALIDATE_EMAIL)
                ? [$buyer->email, $order->reference, $case->reference] : null;
        }
        if (in_array($notice->kind, CommerceNotice::BUYER_ACCOUNT_MAIL_KINDS, true)) {
            $buyer = User::query()->where('role', 'buyer')->find($notice->subject_id);

            return $buyer && filter_var($buyer->email, FILTER_VALIDATE_EMAIL)
                && hash_equals($notice->source_hash ?? '', hash('sha256', $buyer->getEmailForVerification()))
                ? [$buyer->email, null] : null;
        }
        if ($notice->kind === 'cart_reminder') {
            return $this->cartRecipient($notice);
        }
        $order = Order::query()->find($notice->subject_id);
        if (! $order) {
            return null;
        }
        if ($notice->kind === CommerceNotice::ADMIN_TOTAL_REFUND) {
            $admin = $this->boundAdministrator($notice);

            return $admin && TransactionalEmail::adminOrderUrl($order->reference) !== null
                ? [$admin->email, $order->reference] : null;
        }
        if ($notice->kind === CommerceNotice::BUYER_TOTAL_REFUND) {
            $buyer = $this->buyer($order->user_id);

            return $buyer && filter_var($buyer->email, FILTER_VALIDATE_EMAIL)
                ? [$buyer->email, $order->reference] : null;
        }
        if ($notice->kind === CommerceNotice::ADMIN_ORDER_CREATED) {
            $admin = $this->boundAdministrator($notice);

            return $admin
                && ($order->checkout_managed ? $order->paid_at : $order->created_at)?->gte(now()->subDays(self::MAIL_WINDOW_DAYS))
                && TransactionalEmail::adminOrderUrl($order->reference) !== null
                ? [$admin->email, $order->reference] : null;
        }
        $status = $order->getRawOriginal('status');
        $buyer = $this->buyer($order->user_id);
        $address = $buyer?->email;
        if (! $address && $order->user_id === null && str_starts_with($order->owner_key, 'guest:')) {
            $address = $order->contact['email'] ?? null;
        }
        if (! is_string($address) || ! filter_var($address, FILTER_VALIDATE_EMAIL)) {
            return null;
        }
        $earliest = now()->subDays(self::MAIL_WINDOW_DAYS);
        $paidAt = $order->getRawOriginal('paid_at');
        $eligible = match ($notice->kind) {
            'order_created' => $order->checkout_managed
                ? $status === 'paid' && $paidAt !== null && $paidAt >= $earliest->toDateTimeString()
                : $order->created_at->gte($earliest) && in_array($status, ['pending_payment', 'paid', 'payment_review'], true),
            'order_paid' => $status === 'paid' && $paidAt !== null && $paidAt >= $earliest->toDateTimeString(),
            'payment_reminder' => $this->canRemindPayment($order, $buyer),
            'order_ready_for_pickup', 'order_shipped', CommerceNotice::ORDER_DELIVERED => $this->canNotifyFulfilment($notice, $order, $status),
            default => false,
        };

        return $eligible ? [$address, $order->reference] : null;
    }

    public function administratorBinding(): array
    {
        $admin = $this->soleAdministrator();

        return $admin
            ? ['source_hash' => $this->administratorFingerprint($admin)]
            : ['state' => 'cancelled', 'available_at' => null, 'error_code' => 'no_eligible_admin'];
    }

    private function boundAdministrator(CommerceNotice $notice): ?User
    {
        $admin = $this->soleAdministrator();

        return $admin && hash_equals($notice->source_hash ?? '', $this->administratorFingerprint($admin)) ? $admin : null;
    }

    public function soleAdministrator(): ?User
    {
        $admins = User::query()->where('role', 'admin')->limit(2)->get();
        $admin = $admins->count() === 1 ? $admins->first() : null;

        return $admin?->hasVerifiedEmail() && filter_var($admin->email, FILTER_VALIDATE_EMAIL) ? $admin : null;
    }

    public function administratorFingerprint(User $admin): string
    {
        return hash('sha256', $admin->id.'|'.$admin->email);
    }

    public function cartFingerprint(Cart $cart): ?string
    {
        $items = $cart->items()->get(['product_id', 'quantity']);
        if ($items->isEmpty()) {
            return null;
        }

        return hash('sha256', json_encode($items->map(fn ($item) => [(int) $item->product_id, (int) $item->quantity])->all(), JSON_THROW_ON_ERROR));
    }

    private function canRemindPayment(Order $order, ?User $buyer): bool
    {
        $settings = StoreSettings::loadValues();

        return $buyer !== null
            && $settings['remind_payment']
            && BuyerReminderPreference::query()->find($buyer->id)?->payment_reminders
            && $order->getRawOriginal('status') === 'pending_payment'
            && $order->paid_at === null
            && $order->paid_provider_payment_id === null
            && ! array_intersect($order->payment_issues ?? [], ['provider_evidence_mismatch', 'conflicting_provider_timestamp'])
            && $order->reservation_expires_at->isFuture()
            && $order->reservation_expires_at->lte(now()->addMinutes($settings['payment_lead_minutes']));
    }

    private function canNotifyFulfilment(CommerceNotice $notice, Order $order, string $status): bool
    {
        $target = self::FULFILMENT[$notice->kind];
        $current = $order->getRawOriginal('fulfilment_status');
        $shipment = $target !== 'ready_for_pickup';

        return $status === 'paid' && (! $shipment || $order->shipping_method === 'delivery')
            && ($current === $target || ($target === 'shipped' && $current === 'completed'))
            && Schema::hasTable('order_fulfilment_events')
            && DB::table('order_fulfilment_events')->where('order_id', $order->id)->where('to_status', $target)
                ->when($notice->source_at !== null, fn ($query) => $query->where('created_at', $notice->source_at))
                ->where('created_at', '>=', now()->subDays(self::MAIL_WINDOW_DAYS))->exists();
    }

    private function cartRecipient(CommerceNotice $notice): ?array
    {
        $settings = StoreSettings::loadValues();
        $cart = Cart::query()->find($notice->subject_id);
        $buyer = $this->buyer($cart?->user_id);
        if (! $settings['remind_cart'] || ! $buyer || ! filter_var($buyer->email, FILTER_VALIDATE_EMAIL)
            || ! BuyerReminderPreference::query()->find($buyer->id)?->cart_reminders
            || ! $notice->source_at?->equalTo($cart->updated_at)
            || $cart->updated_at->gt(now()->subHours($settings['cart_delay_hours']))
            || $cart->updated_at->lt(now()->subDays(30))
            || $this->cartFingerprint($cart) !== $notice->source_hash
            || Order::query()->where('user_id', $buyer->id)->where('created_at', '>=', $cart->updated_at)->exists()
            || CommerceNotice::query()->where('kind', 'cart_reminder')->where('subject_id', $cart->id)
                ->where('id', '!=', $notice->id)->where(fn ($query) => $query
                ->where('sent_at', '>=', now()->subDays(self::MAIL_WINDOW_DAYS))
                ->orWhere(fn ($query) => $query->whereIn('state', ['sending', 'uncertain'])
                    ->where('started_at', '>=', now()->subDays(self::MAIL_WINDOW_DAYS))))->exists()
            || ! $cart->items()->whereExists(fn ($query) => $query->from('products')->whereColumn('products.id', 'cart_items.product_id')
                ->where('status', 'published')->where('stock', '>', 0))->exists()) {
            return null;
        }

        return [$buyer->email, null];
    }

    private function buyer(?int $id): ?User
    {
        return $id !== null ? User::query()->where('role', 'buyer')->whereNotNull('email_verified_at')->find($id) : null;
    }
}
