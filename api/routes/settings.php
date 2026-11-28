<?php

use App\Http\Controllers\Settings\StoreContactController;
use App\Http\Controllers\Settings\StoreSettingsController;
use Illuminate\Support\Facades\Route;

Route::get('v1/store-info', [StoreSettingsController::class, 'publicInfo']);
Route::post('v1/contact', StoreContactController::class)->middleware('throttle:store-contact');
