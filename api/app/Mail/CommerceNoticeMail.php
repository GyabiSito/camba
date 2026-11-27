<?php

namespace App\Mail;

use App\Commerce\PurchaseTerms;
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
        private array $receipt = [],
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: in_array($this->kind, [
            ...CommerceNotice::BUYER_ACCOUNT_MAIL_KINDS, CommerceNotice::ADMIN_ORDER_CREATED,
            CommerceNotice::ADMIN_WITHDRAWAL_RECEIVED, CommerceNotice::ORDER_DELIVERED,
        ], true)
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

        if (in_array($this->kind, CommerceNotice::REFUND_MAIL_KINDS, true)) {
            $admin = $this->kind === CommerceNotice::ADMIN_TOTAL_REFUND;
            $order = $this->order ?? throw new LogicException('Missing order for refund notice.');
            $actionUrl = $admin
                ? TransactionalEmail::adminOrderUrl($order->reference) ?? throw new LogicException('Missing Admin origin.')
                : $store.'/pedidos/'.rawurlencode($order->reference);

            return new Content(view: TransactionalEmail::HTML, text: TransactionalEmail::TEXT, with: [
                'title' => $this->title(),
                'intro' => match ($this->kind) {
                    CommerceNotice::ADMIN_TOTAL_REFUND => 'Mercado Pago confirmó el reintegro total del pago original.',
                    CommerceNotice::BUYER_WITHDRAWAL_RESOLVED => 'Cerramos tu solicitud de arrepentimiento con el reintegro confirmado.',
                    default => 'Mercado Pago confirmó el reintegro total de tu compra.',
                },
                'details' => [
                    'Referencia del pedido' => $order->reference,
                    'Importe del reintegro' => $order->currency.' '.number_format($order->total_cents / 100, 2, ',', '.'),
                    ...$this->receipt,
                ],
                'actionLabel' => 'Ver pedido',
                'actionUrl' => $actionUrl,
                'withdrawalUrl' => $admin && isset($this->receipt['Constancia'])
                    ? TransactionalEmail::adminWithdrawalUrl($this->receipt['Constancia'])
                    : null,
            ] + $this->support);
        }

        $adminNotice = $this->kind === CommerceNotice::ADMIN_ORDER_CREATED;
        $terms = $this->kind === 'order_created' && $this->order?->terms_version !== null
            ? ($this->order->terms_snapshot ?? PurchaseTerms::read($this->order->terms_version))
            : null;
        [$actionLabel, $actionUrl] = match (true) {
            $adminNotice => ['Ver pedido', TransactionalEmail::adminOrderUrl($this->reference ?? '') ?? throw new LogicException('Missing Admin origin.')],
            $this->kind === CommerceNotice::ADMIN_WITHDRAWAL_RECEIVED => ['Abrir solicitud', TransactionalEmail::adminWithdrawalUrl($this->reference ?? '') ?? throw new LogicException('Missing Admin origin.')],
            $this->kind === CommerceNotice::BUYER_PASSWORD_CHANGED => ['Restablecer contraseña', $store.'/cuenta/recuperar'],
            $this->kind === 'cart_reminder' => ['Ver carrito', $store.'/carrito'],
            $this->kind === CommerceNotice::WITHDRAWAL_RECEIPT => ['Contactanos', $store.'/contacto'],
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
                CommerceNotice::BUYER_PASSWORD_CHANGED => 'Actualizaste la contraseña de tu cuenta de Camba. Si no hiciste este cambio, restablecé tu contraseña desde la tienda y contactanos',
                CommerceNotice::ORDER_DELIVERED => 'Tu pedido ya fue entregado. Podés consultar los detalles en la tienda.',
                CommerceNotice::ADMIN_ORDER_CREATED => 'Entró un pedido en la tienda. Revisá el estado del pago y los datos en Admin.',
                CommerceNotice::ADMIN_WITHDRAWAL_RECEIVED => 'Entró una solicitud de arrepentimiento. Revisá el caso en Admin.',
                CommerceNotice::WITHDRAWAL_RECEIPT => 'Registramos tu solicitud de arrepentimiento. Guardá esta constancia. No confirma que el pedido esté identificado ni que se haya hecho un reintegro.',
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
            ] : $this->receipt,
            'notes' => $terms ? ['Derecho de retracto: '.$terms['withdrawal']] : [],
            'contractUrl' => $terms ? $store.'/terminos-y-condiciones?version='.rawurlencode($terms['version']) : null,
            'actionLabel' => $actionLabel,
            'actionUrl' => $actionUrl,
        ] + $this->support);
    }

    private function title(): string
    {
        return match ($this->kind) {
            CommerceNotice::BUYER_WELCOME => 'Te damos la bienvenida a Camba',
            CommerceNotice::BUYER_PASSWORD_CHANGED => 'Tu contraseña de Camba se actualizó',
            'order_created' => 'Recibimos tu pedido',
            'order_paid' => 'Pago confirmado',
            'payment_reminder' => 'Tu pago sigue pendiente',
            'cart_reminder' => 'Tenés productos en el carrito',
            'order_ready_for_pickup' => 'Tu pedido está listo para retirar',
            'order_shipped' => 'Enviamos tu pedido',
            CommerceNotice::ORDER_DELIVERED => 'Tu pedido fue entregado',
            CommerceNotice::ADMIN_ORDER_CREATED => 'Nuevo pedido en Camba',
            CommerceNotice::ADMIN_WITHDRAWAL_RECEIVED => 'Nueva solicitud de arrepentimiento',
            CommerceNotice::WITHDRAWAL_RECEIPT => 'Constancia de solicitud de arrepentimiento',
            CommerceNotice::BUYER_TOTAL_REFUND => 'Confirmamos tu reintegro',
            CommerceNotice::ADMIN_TOTAL_REFUND => 'Reintegro total verificado',
            CommerceNotice::BUYER_WITHDRAWAL_RESOLVED => 'Resolvimos tu solicitud de arrepentimiento',
        };
    }
}
