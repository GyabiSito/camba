<?php

use App\Http\Controllers\Homepage\HomepageController;
use Illuminate\Support\Facades\Route;

Route::get('v1/homepage', [HomepageController::class, 'show']);
Route::get('v1/homepage/media/{key}/{variant}', [HomepageController::class, 'media'])->whereUuid('key')->whereIn('variant', ['display', 'thumbnail']);
