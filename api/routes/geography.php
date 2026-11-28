<?php

use App\Http\Controllers\Geography\GeographyController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/geography')->group(function (): void {
    Route::get('departments', [GeographyController::class, 'departments']);
    // ponytail: Upstream IDs fit in 15 digits; widen with bigint-aware validation only if the source changes.
    Route::get('departments/{department}/localities', [GeographyController::class, 'localities'])
        ->where('department', '[0-9]{1,15}');
});
