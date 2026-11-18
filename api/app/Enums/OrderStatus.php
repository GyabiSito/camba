<?php

namespace App\Enums;

enum OrderStatus: string
{
    case PendingPayment = 'pending_payment';
    case Paid = 'paid';
    case PaymentExpired = 'payment_expired';
    case PaymentReview = 'payment_review';
    case Refunded = 'refunded';
    case ChargedBack = 'charged_back';
}
