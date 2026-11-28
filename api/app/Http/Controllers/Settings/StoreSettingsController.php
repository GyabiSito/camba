<?php

namespace App\Http\Controllers\Settings;

use App\Models\StoreSettings;
use App\Payments\CheckoutProClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StoreSettingsController
{
    public function publicInfo(CheckoutProClient $checkout): JsonResponse
    {
        $fiscalName = config('store.fiscal_name');
        $validFiscalName = is_string($fiscalName) && trim($fiscalName) !== ''
            && mb_strlen($fiscalName) <= 200 && preg_match('/[\p{C}]/u', $fiscalName) === 0;
        $email = trim((string) config('store.public_contact.email'));
        $phone = trim((string) config('store.public_contact.phone'));
        $dial = str_replace([' ', '.', '(', ')', '-'], '', $phone);
        $settings = StoreSettings::loadValues();

        return response()->json(['data' => [
            ...Arr::only($settings, ['business_name', 'pickup_address', 'delivery_cents']),
            'free_delivery_minimum_cents' => $settings['free_delivery_enabled'] === true && $settings['delivery_cents'] !== null
                ? $settings['free_delivery_minimum_cents'] : null,
            'fiscalName' => $validFiscalName ? trim($fiscalName) : null,
            'support_email' => filter_var($email, FILTER_VALIDATE_EMAIL) ?: null,
            'support_phone' => strlen($phone) <= 40 && preg_match('/\A\+?[0-9]{3,15}\z/', $dial) ? $phone : null,
            'checkout_pro_available' => $checkout->checkoutAvailable(),
        ]]);
    }

    public function show(): JsonResponse
    {
        return $this->privateResponse(['data' => StoreSettings::loadValues()]);
    }

    public function update(Request $request): JsonResponse
    {
        $rules = [
            'business_name' => ['sometimes', 'required', 'string', 'max:120'],
            'support_email' => ['nullable', 'email:rfc', 'max:254'],
            'support_phone' => ['nullable', 'string', 'max:40'],
            'pickup_address' => ['nullable', 'string', 'max:255'],
            'delivery_cents' => ['nullable', 'integer:strict', 'min:0', 'max:2147483647'],
            'free_delivery_enabled' => ['sometimes', 'boolean:strict'],
            'free_delivery_minimum_cents' => ['nullable', 'integer:strict', 'min:1', 'max:2147483647'],
            'remind_payment' => ['sometimes', 'boolean:strict'],
            'payment_lead_minutes' => ['sometimes', 'integer:strict', 'min:1', 'max:25'],
            'remind_cart' => ['sometimes', 'boolean:strict'],
            'cart_delay_hours' => ['sometimes', 'integer:strict', 'min:1', 'max:168'],
            'low_stock_threshold' => ['sometimes', 'integer:strict', 'min:0', 'max:1000'],
            'pending_fulfilment_hours' => ['sometimes', 'integer:strict', 'min:1', 'max:168'],
        ];
        if (array_diff_key($request->all(), $rules) !== []) {
            throw ValidationException::withMessages(['settings' => 'Unsupported setting.']);
        }
        $patch = $request->validate($rules);
        $values = DB::transaction(function () use ($patch, $request): array {
            $settings = StoreSettings::query()->lockForUpdate()->findOrFail(1);
            $before = $settings->effective();
            $settings->values = array_replace($settings->values, $patch);
            $after = $settings->effective();
            if ($after['free_delivery_enabled'] && $after['free_delivery_minimum_cents'] === null) {
                throw ValidationException::withMessages(['free_delivery_minimum_cents' => 'Ingresá un monto mínimo mayor a cero para activar el envío gratis.']);
            }
            if ($settings->isDirty('values')) {
                $settings->save();
                DB::table('store_setting_changes')->insert([
                    'actor_admin_id' => $request->user('admin')->id,
                    'before' => json_encode($before, JSON_THROW_ON_ERROR),
                    'after' => json_encode($after, JSON_THROW_ON_ERROR),
                    'created_at' => now(),
                ]);
            }

            return $after;
        }, 3);

        return $this->privateResponse(['data' => $values]);
    }

    public function history(): JsonResponse
    {
        return $this->privateResponse(DB::table('store_setting_changes')->orderByDesc('id')->paginate(25)
            ->through(fn ($change) => [
                ...((array) $change),
                'before' => json_decode($change->before, true, flags: JSON_THROW_ON_ERROR),
                'after' => json_decode($change->after, true, flags: JSON_THROW_ON_ERROR),
            ])->toArray());
    }

    private function privateResponse(array $payload): JsonResponse
    {
        return response()->json($payload)->header('Cache-Control', 'private, no-store');
    }
}
