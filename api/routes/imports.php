<?php

use App\Http\Controllers\Imports\CatalogImportController;
use Illuminate\Support\Facades\Route;

Route::get('catalog-imports/template', [CatalogImportController::class, 'template'])->name('imports.template');
Route::post('catalog-imports', [CatalogImportController::class, 'store'])->name('imports.store');
Route::get('catalog-imports/{id}', [CatalogImportController::class, 'show'])->whereNumber('id')->name('imports.show');
Route::post('catalog-imports/{id}/confirm', [CatalogImportController::class, 'confirm'])->whereNumber('id')->name('imports.confirm');
