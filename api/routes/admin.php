<?php

use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Catalog\ClassificationController;
use App\Http\Controllers\Catalog\ProductController;
use App\Http\Controllers\Catalog\ProductImagesController;
use App\Http\Controllers\Homepage\HomepageController;
use App\Http\Controllers\Identity\AdminAuthController;
use App\Http\Controllers\Notices\AdminNoticeController;
use App\Http\Controllers\Orders\AdminOrderController;
use App\Http\Controllers\Orders\WithdrawalController;
use App\Http\Controllers\Payments\OrderPaymentController;
use App\Http\Controllers\Settings\StoreSettingsController;
use App\Http\Middleware\AdminRequestForgery;
use App\Http\Middleware\StartAdminSession;
use App\Models\Brand;
use App\Models\Category;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Session\Middleware\AuthenticateSession;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

Route::prefix('v1/admin')->withoutMiddleware(EnsureFrontendRequestsAreStateful::class)
    ->middleware([
        EncryptCookies::class, AddQueuedCookiesToResponse::class, StartAdminSession::class, AdminRequestForgery::class,
    ])->group(function (): void {
        Route::get('auth/csrf-cookie', static fn () => response()->noContent());
        Route::post('auth/login', [AdminAuthController::class, 'login'])->middleware('throttle:admin-login');

        Route::middleware(['auth:admin', AuthenticateSession::class])->group(function (): void {
            Route::get('session', [AdminAuthController::class, 'me']);
            Route::post('auth/logout', [AdminAuthController::class, 'logout']);

            Route::name('admin.catalog.')->group(function (): void {
                require __DIR__.'/imports.php';

                Route::get('products', [ProductController::class, 'index'])->name('products.index');
                Route::post('products', [ProductController::class, 'store'])->name('products.store');
                Route::get('products/{product}', [ProductController::class, 'show'])->whereNumber('product')->name('products.show');
                Route::patch('products/{product}', [ProductController::class, 'update'])->whereNumber('product')->name('products.update');
                Route::get('products/{product}/history', [ProductController::class, 'history'])->whereNumber('product')->name('products.history');
                Route::post('products/{product}/publish', [ProductController::class, 'publish'])->whereNumber('product')->name('products.publish');
                Route::post('products/{product}/archive', [ProductController::class, 'archive'])->whereNumber('product')->name('products.archive');
                Route::post('products/{product}/images', [ProductImagesController::class, 'store'])->whereNumber('product')->name('products.images.store');
                Route::post('products/{product}/images/uploads', [ProductImagesController::class, 'store'])->whereNumber('product')->name('products.images.uploads');
                Route::post('products/{product}/images/uploads/replace', [ProductImagesController::class, 'store'])->whereNumber('product')->name('products.images.replace');
                Route::post('products/{product}/images/uploads/close', [ProductImagesController::class, 'close'])->whereNumber('product')->name('products.images.close');
                Route::put('products/{product}/images/order', [ProductImagesController::class, 'order'])->whereNumber('product')->name('products.images.order');

                foreach (['categories' => Category::class, 'brands' => Brand::class] as $path => $model) {
                    Route::get($path, [ClassificationController::class, 'index'])->defaults('classification', $model)->name("$path.index");
                    Route::get("$path/page", [ClassificationController::class, 'page'])
                        ->defaults('classification', $model)->name("$path.page");
                    Route::post($path, [ClassificationController::class, 'store'])->defaults('classification', $model)->name("$path.store");
                    Route::patch("$path/{id}", [ClassificationController::class, 'update'])->whereNumber('id')
                        ->defaults('classification', $model)->name("$path.update");
                }
            });

            Route::prefix('users')->group(function (): void {
                Route::get('/', [CustomerController::class, 'index']);
                Route::get('{customer}', [CustomerController::class, 'show'])->whereNumber('customer');
                Route::get('{customer}/orders', [CustomerController::class, 'orders'])->whereNumber('customer');
            });

            Route::get('dashboard', DashboardController::class);

            Route::prefix('homepage')->name('admin.homepage.')->group(function (): void {
                Route::get('', [HomepageController::class, 'edit'])->name('edit');
                Route::put('', [HomepageController::class, 'update'])->name('update');
                Route::post('publish', [HomepageController::class, 'publish'])->name('publish');
                Route::post('discard', [HomepageController::class, 'discard'])->name('discard');
                Route::get('preview', [HomepageController::class, 'preview'])->name('preview');
                Route::post('media', [HomepageController::class, 'upload'])->name('upload');
                Route::get('media/{key}/{variant}', [HomepageController::class, 'media'])->whereUuid('key')->whereIn('variant', ['display', 'thumbnail'])->name('media');
            });

            Route::get('notices', AdminNoticeController::class);

            Route::prefix('withdrawals')->group(function (): void {
                Route::get('/', [WithdrawalController::class, 'index']);
                Route::patch('{reference}', [WithdrawalController::class, 'update'])->whereUuid('reference');
            });

            Route::prefix('orders')->group(function (): void {
                Route::get('/', [AdminOrderController::class, 'index']);
                Route::get('{reference}', [AdminOrderController::class, 'show'])->whereUuid('reference');
                Route::patch('{reference}/fulfilment', [AdminOrderController::class, 'fulfil'])->whereUuid('reference');
            });

            Route::post('orders/{reference}/payments/refresh', [OrderPaymentController::class, 'refreshAsAdmin'])->whereUuid('reference');

            Route::prefix('settings')->group(function (): void {
                Route::get('/', [StoreSettingsController::class, 'show']);
                Route::patch('/', [StoreSettingsController::class, 'update']);
                Route::get('history', [StoreSettingsController::class, 'history']);
            });
        });
    });
