<?php

namespace App\Actions\Notices;

use App\Models\Cart;
use App\Models\CatalogImport;
use App\Models\CommerceNotice;
use App\Models\Order;
use App\Models\Product;
use App\Models\StoreSettings;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;

class ProjectCommerceNotices
{
    private const LIMIT = 100;

    private const PAYMENT_ISSUES = [
        'stock_release_conflict', 'provider_evidence_mismatch', 'conflicting_provider_timestamp', 'payment_reversed',
        'multiple_approved_payments', 'approval_after_order_closed', 'late_approval_without_stock',
    ];

    public function __construct(private readonly NoticeEligibility $eligibility) {}

    public function execute(): void
    {
        $settings = StoreSettings::loadValues();
        $recent = now()->subDays(NoticeEligibility::MAIL_WINDOW_DAYS);
        $created = Order::query()->where(fn (Builder $query) => $query
            ->where(fn (Builder $orders) => $orders->where('checkout_managed', false)->where('created_at', '>=', $recent))
            ->orWhere(fn (Builder $orders) => $orders->where('checkout_managed', true)->where('status', 'paid')->where('paid_at', '>=', $recent)));
        $paid = Order::query()->where('status', 'paid')->where('paid_at', '>=', $recent);
        foreach (['panel', 'mail'] as $channel) {
            $this->events(clone $created, $channel, 'order_created', 'order');
            $this->events(clone $paid, $channel, 'order_paid', 'order');
        }
        // ponytail: JSON issue scans are suitable for the small store; add an indexed issue cursor if these scans become a bottleneck.
        foreach (self::PAYMENT_ISSUES as $issue) {
            $this->events(Order::query()->whereJsonContains('payment_issues', $issue), 'panel', 'payment_issue', 'order', $issue);
        }
        $completed = CatalogImport::query()->whereNotNull('completed_at');
        $reportable = fn ($query) => $query->whereIn('status', ['invalid', 'failed']);
        $this->events((clone $completed)->whereDoesntHave('rows', $reportable), 'panel', 'import_completed', 'import');
        $this->events($completed->whereHas('rows', $reportable), 'panel', 'import_completed_with_errors', 'import');
        $this->condition(CatalogImport::query()->whereNull('completed_at')->where('confirmed_at', '<=', now()->subHour()), 'import_stalled', 'import');
        $this->condition(Product::query()->published()->where('stock', '<=', $settings['low_stock_threshold']), 'low_stock', 'product');
        $overdue = Order::query()->where('status', 'paid')->where('paid_at', '<=', now()->subHours($settings['pending_fulfilment_hours']));
        if (Schema::hasColumn('orders', 'fulfilment_status')) {
            $overdue->whereIn('fulfilment_status', NoticeEligibility::PENDING_FULFILMENT);
            if (Schema::hasTable('order_fulfilment_events')) {
                $this->events(Order::query()->where('status', 'paid')->where('fulfilment_status', 'ready_for_pickup')
                    ->whereExists(fn ($query) => $query->from('order_fulfilment_events')->whereColumn('order_id', 'orders.id')
                        ->where('to_status', 'ready_for_pickup')->where('created_at', '>=', $recent)), 'mail', 'order_ready_for_pickup', 'order');
            }
        }
        $this->condition($overdue, 'paid_overdue', 'order');
        if ($settings['remind_payment']) {
            $this->events(Order::query()->where('checkout_managed', false)->where('status', 'pending_payment')->whereNull('paid_at')
                ->where('reservation_expires_at', '>', now())->where('reservation_expires_at', '<=', now()->addMinutes($settings['payment_lead_minutes']))
                ->whereExists(fn ($query) => $query->from('buyer_reminder_preferences')->whereColumn('user_id', 'orders.user_id')
                    ->where('payment_reminders', true)), 'mail', 'payment_reminder', 'order');
        }
        if ($settings['remind_cart']) {
            $this->carts($settings['cart_delay_hours']);
        }
        CommerceNotice::query()->where('state', 'sending')->where('started_at', '<=', now()->subMinutes(15))
            ->update(['state' => 'uncertain', 'error_code' => 'worker_interrupted']);
    }

    private function events(Builder $source, string $channel, string $kind, string $subject, ?string $issue = null): void
    {
        $this->unprojected($source, $channel, $kind, $subject, $issue);
        foreach ($source->orderBy('id')->limit(self::LIMIT)->pluck('id') as $id) {
            $this->record($channel, $kind, $subject, $id, $issue);
        }
    }

    private function condition(Builder $source, string $kind, string $subject): void
    {
        CommerceNotice::query()->where('channel', 'panel')->where('kind', $kind)->where('subject_type', $subject)
            ->where('state', 'active')->whereNotIn('subject_id', (clone $source)->select('id'))
            ->update(['state' => 'resolved']);

        $this->unprojected($source, 'panel', $kind, $subject, null, onlyActive: true);
        foreach ($source->orderBy('id')->limit(self::LIMIT)->pluck('id') as $id) {
            $notice = $this->record('panel', $kind, $subject, $id);
            if ($notice->state === 'resolved') {
                $notice->update(['state' => 'active']);
            }
        }
    }

    private function carts(int $delayHours): void
    {
        $source = Cart::query()->whereNotNull('user_id')->whereHas('items')
            ->whereBetween('updated_at', [now()->subDays(30), now()->subHours($delayHours)])
            ->whereExists(fn ($query) => $query->from('buyer_reminder_preferences')->whereColumn('user_id', 'carts.user_id')
                ->where('cart_reminders', true))
            ->whereNotExists(fn ($query) => $query->from('orders')->whereColumn('orders.user_id', 'carts.user_id')
                ->whereColumn('orders.created_at', '>=', 'carts.updated_at'));
        $this->unprojected($source, 'mail', 'cart_reminder', 'cart', null, compareCartRevision: true);
        foreach ($source->orderBy('id')->limit(self::LIMIT)->get() as $cart) {
            $hash = $this->eligibility->cartFingerprint($cart);
            if ($hash !== null) {
                $this->record('mail', 'cart_reminder', 'cart', $cart->id, sourceAt: $cart->updated_at, sourceHash: $hash);
            }
        }
    }

    private function unprojected(Builder $source, string $channel, string $kind, string $subject, ?string $issue, bool $onlyActive = false, bool $compareCartRevision = false): void
    {
        $table = $source->getModel()->getTable();
        $source->whereNotExists(fn ($query) => $query->from('commerce_notices')
            ->whereColumn('commerce_notices.subject_id', "$table.id")
            ->where('channel', $channel)->where('kind', $kind)->where('subject_type', $subject)->where('issue', $issue)
            ->when($onlyActive, fn ($query) => $query->where('state', 'active'))
            ->when($compareCartRevision, fn ($query) => $query->whereColumn('commerce_notices.source_at', 'carts.updated_at')));
    }

    private function record(string $channel, string $kind, string $subject, int $id, ?string $issue = null, ?DateTimeInterface $sourceAt = null, ?string $sourceHash = null): CommerceNotice
    {
        $key = implode(':', [$channel, $kind, $subject, $id, $issue, $sourceAt?->getTimestamp()]);

        return CommerceNotice::query()->createOrFirst(['dedup_key' => $key], [
            'channel' => $channel, 'kind' => $kind, 'subject_type' => $subject, 'subject_id' => $id,
            'issue' => $issue, 'source_at' => $sourceAt, 'source_hash' => $sourceHash,
            'state' => $channel === 'mail' ? 'pending' : 'active', 'available_at' => $channel === 'mail' ? now() : null,
        ]);
    }
}
