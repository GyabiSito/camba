<?php

use App\Commerce\PurchaseTerms;
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
    Route::post('withdrawals/{reference}/confirmation', [WithdrawalController::class, 'confirm'])
        ->whereUuid('reference')->middleware('throttle:10,1');
    Route::post('checkout/quote', [OrderController::class, 'quote']);
    Route::get('orders', [OrderController::class, 'index']);
    Route::post('orders', [OrderController::class, 'store'])->middleware(['auth:web', 'can:camba-buyer'])->name('orders.store');
    Route::get('orders/{reference}', [OrderController::class, 'show'])->whereUuid('reference');
});
