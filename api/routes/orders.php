<?php

use App\Commerce\PurchaseTerms;
use App\Http\Controllers\Orders\AdminOrderController;
use App\Http\Controllers\Orders\OrderController;
use App\Http\Controllers\Orders\WithdrawalController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('purchase-terms/{version?}', function (string $version = PurchaseTerms::VERSION) {
        $terms = PurchaseTerms::read($version);
        abort_if($terms === null, 404);

        return ['data' => $terms];
    });
    Route::post('withdrawals', [WithdrawalController::class, 'store'])->middleware('throttle:withdrawal');
    Route::post('checkout/quote', [OrderController::class, 'quote']);
    Route::get('orders', [OrderController::class, 'index']);
    Route::post('orders', [OrderController::class, 'store'])->middleware(['auth:web', 'can:camba-buyer'])->name('orders.store');
    Route::get('orders/{reference}', [OrderController::class, 'show'])->whereUuid('reference');
});

Route::prefix('v1/admin/withdrawals')->middleware(['auth:sanctum', 'can:camba-admin'])->group(function (): void {
    Route::get('/', [WithdrawalController::class, 'index']);
    Route::patch('{reference}', [WithdrawalController::class, 'update'])->whereUuid('reference');
});

Route::prefix('v1/admin/orders')->middleware(['auth:sanctum', 'can:camba-admin'])->group(function (): void {
    Route::get('/', [AdminOrderController::class, 'index']);
    Route::get('{reference}', [AdminOrderController::class, 'show'])->whereUuid('reference');
    Route::patch('{reference}/fulfilment', [AdminOrderController::class, 'fulfil'])->whereUuid('reference');
});
