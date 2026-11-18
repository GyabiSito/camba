<?php

use App\Http\Controllers\Orders\OrderController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('checkout/quote', [OrderController::class, 'quote']);
    Route::get('orders', [OrderController::class, 'index']);
    Route::post('orders', [OrderController::class, 'store'])->name('orders.store');
    Route::get('orders/{reference}', [OrderController::class, 'show'])->whereUuid('reference');
});
