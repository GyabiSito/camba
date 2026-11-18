<?php

use App\Http\Controllers\Cart\CartController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/cart')->group(function (): void {
    Route::get('/', [CartController::class, 'show']);
    Route::post('items/{product}', [CartController::class, 'addItem'])->whereNumber('product');
    Route::put('items/{product}', [CartController::class, 'setItem'])->whereNumber('product');
    Route::delete('items/{product}', [CartController::class, 'removeItem'])->whereNumber('product');
});
