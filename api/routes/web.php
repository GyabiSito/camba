<?php

use App\Http\Controllers\BackendReadinessController;
use App\Http\Controllers\Identity\AuthController;
use App\Http\Middleware\RedirectEmailVerification;
use Illuminate\Support\Facades\Route;

Route::get('/ready', BackendReadinessController::class)->withoutMiddleware('web');

Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verify'])
    ->middleware([RedirectEmailVerification::class, 'signed', 'throttle:6,1'])
    ->whereNumber('id')
    ->name('verification.verify');
