<?php

use App\Http\Controllers\Payments\OrderPaymentController;
use App\Http\Controllers\Payments\PaymentWebhookController;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

Route::post('v1/orders/{reference}/payments', [OrderPaymentController::class, 'store'])->whereUuid('reference');
Route::post('v1/orders/{reference}/payments/refresh', [OrderPaymentController::class, 'refresh'])->whereUuid('reference');
Route::post('v1/admin/orders/{reference}/payments/refresh', [OrderPaymentController::class, 'refreshAsAdmin'])->whereUuid('reference')
    ->middleware(['auth:sanctum', 'can:camba-admin']);
Route::post('v1/webhooks/mercadopago', [PaymentWebhookController::class, 'store'])
    ->withoutMiddleware(EnsureFrontendRequestsAreStateful::class);
