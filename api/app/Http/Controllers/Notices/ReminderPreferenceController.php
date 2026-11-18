<?php

namespace App\Http\Controllers\Notices;

use App\Http\Requests\Notices\UpdateReminderPreferenceRequest;
use App\Models\BuyerReminderPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReminderPreferenceController
{
    public function show(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'buyer' && $request->user()->hasVerifiedEmail(), 403);
        $preferences = BuyerReminderPreference::query()->find($request->user()->id);

        return response()->json(['data' => [
            'payment_reminders' => $preferences?->payment_reminders ?? false,
            'cart_reminders' => $preferences?->cart_reminders ?? false,
        ]])->header('Cache-Control', 'private, no-store');
    }

    public function update(UpdateReminderPreferenceRequest $request): JsonResponse
    {
        $patch = $request->validated();
        if ($patch !== []) {
            BuyerReminderPreference::query()->upsert(
                [['user_id' => $request->user()->id, ...$patch]],
                ['user_id'],
                array_keys($patch),
            );
        }

        return $this->show($request);
    }
}
