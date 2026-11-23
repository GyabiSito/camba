<?php

use App\Http\Controllers\Admin\DashboardController;
use Illuminate\Support\Facades\Route;

Route::get('v1/admin/dashboard', DashboardController::class)
    ->middleware(['auth:sanctum', 'can:camba-admin']);
