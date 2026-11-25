<?php

namespace App\Http\Controllers\Geography;

use App\Models\Department;
use App\Models\Locality;
use Illuminate\Http\JsonResponse;

class GeographyController
{
    public function departments(): JsonResponse
    {
        return response()->json(['data' => Department::query()->orderBy('name')->orderBy('id')->get(['id', 'name'])]);
    }

    public function localities(Department $department): JsonResponse
    {
        return response()->json(['data' => Locality::query()->where('department_id', $department->id)
            ->orderBy('name')->orderBy('id')->get(['id', 'name'])]);
    }
}
