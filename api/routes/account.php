<?php

use App\Http\Controllers\Account\AddressController;
use App\Http\Controllers\Account\ProfileController;
use App\Http\Controllers\Identity\AuthController;
use Illuminate\Support\Facades\Route;

Route::patch('v1/account/password', [ProfileController::class, 'updatePassword'])
    ->middleware(['auth:web', 'can:camba-buyer', 'throttle:account-password']);

Route::prefix('v1/account')->middleware('auth:sanctum')->group(function (): void {
    Route::get('profile', [AuthController::class, 'me']);
    Route::patch('profile', [ProfileController::class, 'update']);
    Route::get('addresses', [AddressController::class, 'index']);
    Route::post('addresses', [AddressController::class, 'store']);
    Route::get('addresses/{address}', [AddressController::class, 'show'])->whereNumber('address');
    Route::patch('addresses/{address}', [AddressController::class, 'update'])->whereNumber('address');
    Route::delete('addresses/{address}', [AddressController::class, 'destroy'])->whereNumber('address');
});
