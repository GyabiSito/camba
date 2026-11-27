<?php

use App\Http\Controllers\Orders\AdminOrderController;
use App\Http\Controllers\Orders\OrderController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('checkout/quote', [OrderController::class, 'quote']);
    Route::get('orders', [OrderController::class, 'index']);
    Route::post('orders', [OrderController::class, 'store'])->middleware(['auth:web', 'can:camba-buyer'])->name('orders.store');
    Route::get('orders/{reference}', [OrderController::class, 'show'])->whereUuid('reference');
});

Route::prefix('v1/admin/orders')->middleware(['auth:sanctum', 'can:camba-admin'])->group(function (): void {
    Route::get('/', [AdminOrderController::class, 'index']);
    Route::get('{reference}', [AdminOrderController::class, 'show'])->whereUuid('reference');
    Route::patch('{reference}/fulfilment', [AdminOrderController::class, 'fulfil'])->whereUuid('reference');
});
