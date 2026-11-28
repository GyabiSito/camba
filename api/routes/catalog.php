<?php

use App\Http\Controllers\Catalog\ClassificationController;
use App\Http\Controllers\Catalog\ProductController;
use App\Models\Brand;
use App\Models\Category;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('products', [ProductController::class, 'index']);
    Route::get('products/{slug}', [ProductController::class, 'publicShow']);

    foreach (['categories' => Category::class, 'brands' => Brand::class] as $path => $model) {
        Route::get($path, [ClassificationController::class, 'index'])->defaults('classification', $model);
    }
});
