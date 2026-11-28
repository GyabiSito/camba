<?php

namespace App\Http\Controllers\Admin;

use App\Queries\Admin\DashboardSummary;
use Illuminate\Http\JsonResponse;

class DashboardController
{
    public function __invoke(DashboardSummary $summary): JsonResponse
    {
        return response()->json(['data' => $summary->get()])->header('Cache-Control', 'private, no-store');
    }
}
