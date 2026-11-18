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
            'order_created' => 'Camba: recibimos tu pedido',
            'order_paid' => 'Camba: pago confirmado',
            'payment_reminder' => 'Camba: tu pago sigue pendiente',
            'cart_reminder' => 'Camba: tenés productos en el carrito',
            'order_ready_for_pickup' => 'Camba: tu pedido está listo para retirar',
            'order_shipped' => 'Camba: enviamos tu pedido',
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
                'order_created' => 'Recibimos tu pedido. Consultá en la tienda el estado del pago y de la entrega.',
                'order_paid' => 'Confirmamos tu pago. Consultá en la tienda los próximos pasos de tu pedido.',
                'payment_reminder' => 'Tu pedido está pendiente de pago. Revisá su estado antes de intentar pagar.',
                'cart_reminder' => 'Todavía tenés productos en el carrito. Los precios y la disponibilidad pueden haber cambiado.',
                'order_ready_for_pickup' => 'Tu pedido está listo. Consultá en la tienda los datos para retirarlo.',
                'order_shipped' => 'Enviamos tu pedido. Consultá en la tienda el estado de la entrega.',
            },
            'storeUrl' => config('app.url'),
        ]);
    }
}
