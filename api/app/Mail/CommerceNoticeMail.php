<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;

class CommerceNoticeMail extends Mailable
{
    public function __construct(public int $noticeId, public string $kind, public ?string $reference) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: match ($this->kind) {
            'order_created' => 'Camba: Your order was received',
            'order_paid' => 'Camba: Payment confirmed',
            'payment_reminder' => 'Camba: Payment is still pending',
            'cart_reminder' => 'Camba: You have items in your cart',
            'order_ready_for_pickup' => 'Camba: Your order is ready for pickup',
            'order_shipped' => 'Camba: Your order has shipped',
        });
    }

    public function headers(): Headers
    {
        $domain = parse_url(config('app.url'), PHP_URL_HOST) ?: 'camba.local';

        return new Headers(messageId: "camba-notice-{$this->noticeId}@$domain");
    }

    public function content(): Content
    {
        return new Content(text: 'mail.notices.commerce', with: [
            'bodyText' => match ($this->kind) {
                'order_created' => 'We received your order. Check the store for its current payment and fulfilment status.',
                'order_paid' => 'Your payment was confirmed. Check the store for your order’s next steps.',
                'payment_reminder' => 'Your order is awaiting payment. Check its current status before trying to pay.',
                'cart_reminder' => 'Items are still in your cart. Prices and availability may have changed.',
                'order_ready_for_pickup' => 'Your order is ready. Check the store for your pickup details.',
                'order_shipped' => 'Your order has shipped. Check the store for the latest status.',
            },
            'storeUrl' => config('app.url'),
        ]);
    }
}
