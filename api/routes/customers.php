<?php

use App\Http\Controllers\Admin\CustomerController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/admin/users')->middleware(['auth:sanctum', 'can:camba-admin'])->group(function (): void {
    Route::get('/', [CustomerController::class, 'index']);
    Route::get('{customer}', [CustomerController::class, 'show'])->whereNumber('customer');
    Route::get('{customer}/orders', [CustomerController::class, 'orders'])->whereNumber('customer');
});
