<?php

namespace App\Actions\Notices;

use App\Models\CommerceNotice;
use App\Models\Order;
use DateTimeInterface;

class RecordOrderMail
{
    public function __construct(private readonly NoticeEligibility $eligibility) {}

    public function created(Order $order): void
    {
        $this->record($order, CommerceNotice::ADMIN_ORDER_CREATED, $order->checkout_managed ? $order->paid_at : $order->created_at,
            $this->eligibility->administratorBinding());
    }

    public function fulfilment(Order $order, string $stage, DateTimeInterface $occurredAt): void
    {
        if ($order->shipping_method !== 'delivery') {
            return;
        }
        $kind = match ($stage) {
            'shipped' => 'order_shipped',
            'completed' => CommerceNotice::ORDER_DELIVERED,
            default => null,
        };
        if ($kind !== null) {
            $this->record($order, $kind, $occurredAt);
        }
    }

    private function record(Order $order, string $kind, DateTimeInterface $occurredAt, array $attributes = []): void
    {
        // Match the existing projector's order-event key, including the empty issue and revision slots.
        CommerceNotice::query()->createOrFirst(['dedup_key' => "mail:$kind:order:{$order->id}::"], [
            'channel' => 'mail', 'kind' => $kind, 'subject_type' => 'order', 'subject_id' => $order->id,
            'source_at' => $occurredAt, 'state' => 'pending', 'available_at' => now(), ...$attributes,
        ]);
    }
}
