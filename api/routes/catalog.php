<?php

use App\Http\Controllers\Catalog\ClassificationController;
use App\Http\Controllers\Catalog\ProductController;
use App\Http\Controllers\Catalog\ProductImagesController;
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

Route::prefix('v1/admin')->name('admin.catalog.')->middleware(['auth:sanctum', 'can:camba-admin'])->group(function (): void {
    Route::get('products', [ProductController::class, 'index'])->name('products.index');
    Route::post('products', [ProductController::class, 'store'])->name('products.store');
    Route::get('products/{product}', [ProductController::class, 'show'])->whereNumber('product')->name('products.show');
    Route::patch('products/{product}', [ProductController::class, 'update'])->whereNumber('product')->name('products.update');
    Route::post('products/{product}/publish', [ProductController::class, 'publish'])->whereNumber('product')->name('products.publish');
    Route::post('products/{product}/archive', [ProductController::class, 'archive'])->whereNumber('product')->name('products.archive');
    Route::post('products/{product}/images', [ProductImagesController::class, 'store'])->whereNumber('product')->name('products.images.store');
    Route::put('products/{product}/images/order', [ProductImagesController::class, 'order'])->whereNumber('product')->name('products.images.order');

    foreach (['categories' => Category::class, 'brands' => Brand::class] as $path => $model) {
        Route::get($path, [ClassificationController::class, 'index'])->defaults('classification', $model)->name("$path.index");
        Route::post($path, [ClassificationController::class, 'store'])->defaults('classification', $model)->name("$path.store");
        Route::patch("$path/{id}", [ClassificationController::class, 'update'])->whereNumber('id')
            ->defaults('classification', $model)->name("$path.update");
    }
});
