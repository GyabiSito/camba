<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Throwable;

class BackendReadinessController
{
    public function __invoke(): JsonResponse
    {
        try {
            $ready = DB::selectOne('SELECT 1', [], false) !== null && (bool) Redis::connection()->ping();
        } catch (Throwable) {
            $ready = false;
        }

        return response()->json(['status' => $ready ? 'ready' : 'not_ready'], $ready ? 200 : 503, ['Cache-Control' => 'no-store']);
    }
}
