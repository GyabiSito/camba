<?php

namespace App\Http\Controllers\Notices;

use App\Http\Resources\Notices\CommerceNoticeResource;
use App\Models\CommerceNotice;
use App\Models\Order;
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

        $orderIds = $notices->getCollection()->where('subject_type', 'order')->pluck('subject_id');
        $references = Order::query()->whereKey($orderIds->all())->pluck('reference', 'id');
        $notices->through(fn (CommerceNotice $notice) => $notice->setAttribute('order_reference',
            $notice->subject_type === 'order' ? $references->get($notice->subject_id) : null));

        return CommerceNoticeResource::collection($notices)->response()->header('Cache-Control', 'private, no-store');
    }
}
