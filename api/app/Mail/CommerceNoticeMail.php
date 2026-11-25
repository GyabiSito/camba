<?php

namespace App\Mail;

use App\Enums\OrderStatus;
use App\Models\CommerceNotice;
use App\Models\Order;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;
use LogicException;

class CommerceNoticeMail extends Mailable
{
    public function __construct(
        public int $noticeId,
        public string $kind,
        public ?string $reference,
        private ?Order $order = null,
        private array $support = [],
        private ?string $buyerName = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: in_array($this->kind, [CommerceNotice::BUYER_WELCOME, CommerceNotice::ADMIN_ORDER_CREATED, CommerceNotice::ORDER_DELIVERED], true)
            ? $this->title()
            : 'Camba: '.mb_lcfirst($this->title()));
    }

    public function headers(): Headers
    {
        $domain = parse_url(config('app.url'), PHP_URL_HOST) ?: 'camba.local';

        return new Headers(messageId: "camba-notice-{$this->noticeId}@$domain");
    }

    public function content(): Content
    {
        $store = rtrim(config('app.url'), '/');
        if ($this->kind === CommerceNotice::BUYER_WELCOME) {
            $name = trim($this->buyerName ?? '');
            $greeting = $name === '' ? '¡Hola!' : "Hola, $name.";

            return new Content(view: 'mail.buyer-welcome', text: 'mail.buyer-welcome-text', with: [
                'subject' => $this->title(),
                'greeting' => "$greeting Gracias por sumarte a Camba. Ya podés recorrer la tienda y descubrir prendas para combinar a tu manera. Te enviamos por separado un enlace para verificar tu correo.",
                'shopUrl' => $store.'/tienda',
            ] + $this->support);
        }

        $adminNotice = $this->kind === CommerceNotice::ADMIN_ORDER_CREATED;
        [$actionLabel, $actionUrl] = match (true) {
            $adminNotice => ['Ver pedido', TransactionalEmail::adminOrderUrl($this->reference ?? '') ?? throw new LogicException('Missing Admin origin.')],
            $this->kind === 'cart_reminder' => ['Ver carrito', $store.'/carrito'],
            $this->order?->user_id !== null => ['Ver pedido', $store.'/pedidos/'.rawurlencode($this->reference)],
            default => ['Ir a la tienda', $store],
        };

        return new Content(view: TransactionalEmail::HTML, text: TransactionalEmail::TEXT, with: [
            'title' => $this->title(),
            'intro' => match ($this->kind) {
                'order_created' => 'Consultá el estado del pago y de la entrega en la tienda.',
                'order_paid' => 'Confirmamos tu pago. Consultá los próximos pasos en la tienda.',
                'payment_reminder' => 'Revisá el estado de tu pedido antes de intentar pagar.',
                'cart_reminder' => 'Si querés retomarlo, revisá los precios y la disponibilidad antes de comprar.',
                'order_ready_for_pickup' => 'Consultá en la tienda los datos para retirar tu pedido.',
                'order_shipped' => 'Consultá en la tienda el estado de la entrega.',
                CommerceNotice::ORDER_DELIVERED => 'Tu pedido ya fue entregado. Podés consultar los detalles en la tienda.',
                CommerceNotice::ADMIN_ORDER_CREATED => 'Entró un pedido en la tienda. Revisá el estado del pago y los datos en Admin.',
            },
            'details' => $this->order ? [
                'Referencia' => $this->reference,
                ...($adminNotice ? ['Modalidad' => $this->order->shipping_method === 'pickup' ? 'Retiro' : 'Envío'] : []),
                ($adminNotice ? 'Pago' : 'Estado') => match ($this->kind) {
                    'order_ready_for_pickup' => 'Listo para retirar',
                    'order_shipped' => 'Enviado',
                    CommerceNotice::ORDER_DELIVERED => 'Entregado',
                    default => match ($this->order->status) {
                        OrderStatus::PendingPayment => 'Pendiente de pago',
                        OrderStatus::Paid => 'Pago confirmado',
                        OrderStatus::PaymentReview => 'Pago en revisión',
                        OrderStatus::PaymentExpired => 'Pago vencido',
                        OrderStatus::Refunded => 'Reembolsado',
                        OrderStatus::ChargedBack => 'Pago contracargado',
                    },
                },
                'Total' => 'UYU '.number_format($this->order->total_cents / 100, 2, ',', '.'),
            ] : [],
            'actionLabel' => $actionLabel,
            'actionUrl' => $actionUrl,
        ] + $this->support);
    }

    private function title(): string
    {
        return match ($this->kind) {
            CommerceNotice::BUYER_WELCOME => 'Te damos la bienvenida a Camba',
            'order_created' => 'Recibimos tu pedido',
            'order_paid' => 'Pago confirmado',
            'payment_reminder' => 'Tu pago sigue pendiente',
            'cart_reminder' => 'Tenés productos en el carrito',
            'order_ready_for_pickup' => 'Tu pedido está listo para retirar',
            'order_shipped' => 'Enviamos tu pedido',
            CommerceNotice::ORDER_DELIVERED => 'Tu pedido fue entregado',
            CommerceNotice::ADMIN_ORDER_CREATED => 'Nuevo pedido en Camba',
        };
    }
}
