<?php

namespace App\Http\Controllers\Notices;

use App\Http\Resources\Notices\CommerceNoticeResource;
use App\Models\CommerceNotice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminNoticeController
{
    public function __invoke(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'state' => ['sometimes', 'in:active,resolved,failed,uncertain'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:2147483647'],
        ]);
        $notices = CommerceNotice::query()
            ->where(fn ($query) => $query->where('channel', 'panel')
                ->orWhere(fn ($query) => $query->where('channel', 'mail')->whereIn('state', ['failed', 'uncertain'])))
            ->when($filters['state'] ?? null, fn ($query, $state) => $query->where('state', $state))
            ->orderByDesc('updated_at')->orderByDesc('id')->paginate(25)->appends($filters);

        return CommerceNoticeResource::collection($notices)->response()->header('Cache-Control', 'private, no-store');
    }
}
