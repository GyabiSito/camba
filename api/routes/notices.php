<?php

use App\Http\Controllers\Notices\AdminNoticeController;
use App\Http\Controllers\Notices\ReminderPreferenceController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('v1/account')->group(function (): void {
    Route::get('reminder-preferences', [ReminderPreferenceController::class, 'show']);
    Route::patch('reminder-preferences', [ReminderPreferenceController::class, 'update']);
});

Route::get('v1/admin/notices', AdminNoticeController::class)->middleware(['auth:sanctum', 'can:camba-admin']);
