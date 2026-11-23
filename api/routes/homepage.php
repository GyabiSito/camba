<?php

use App\Http\Controllers\Homepage\HomepageController;
use Illuminate\Support\Facades\Route;

Route::get('v1/homepage', [HomepageController::class, 'show']);
Route::get('v1/homepage/media/{key}/{variant}', [HomepageController::class, 'media'])->whereUuid('key')->whereIn('variant', ['display', 'thumbnail']);

Route::prefix('v1/admin/homepage')->name('admin.homepage.')->middleware(['auth:sanctum', 'can:camba-admin'])->group(function (): void {
    Route::get('', [HomepageController::class, 'edit'])->name('edit');
    Route::put('', [HomepageController::class, 'update'])->name('update');
    Route::post('publish', [HomepageController::class, 'publish'])->name('publish');
    Route::post('discard', [HomepageController::class, 'discard'])->name('discard');
    Route::get('preview', [HomepageController::class, 'preview'])->name('preview');
    Route::post('media', [HomepageController::class, 'upload'])->name('upload');
    Route::get('media/{key}/{variant}', [HomepageController::class, 'media'])->whereUuid('key')->whereIn('variant', ['display', 'thumbnail'])->name('media');
});
