<?php

use App\Http\Controllers\Identity\AuthController;
use App\Http\Controllers\Identity\PasswordController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/auth')->group(function (): void {
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:register');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('forgot-password', [PasswordController::class, 'requestLink'])->middleware('throttle:password-reset');
    Route::post('reset-password', [PasswordController::class, 'reset'])->middleware('throttle:password-reset');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('email/verification-notification', [AuthController::class, 'resendVerification'])
            ->middleware('throttle:verification-notification');
    });
});

Route::get('v1/admin/session', [AuthController::class, 'me'])->middleware(['auth:sanctum', 'can:camba-admin']);

require __DIR__.'/account.php';
require __DIR__.'/catalog.php';
require __DIR__.'/cart.php';
require __DIR__.'/orders.php';
require __DIR__.'/payments.php';
require __DIR__.'/settings.php';
require __DIR__.'/notices.php';
require __DIR__.'/homepage.php';
require __DIR__.'/dashboard.php';
