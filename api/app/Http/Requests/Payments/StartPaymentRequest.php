<?php

namespace App\Http\Requests\Payments;

use App\Http\Requests\Orders\OrderSessionRequest;
use Illuminate\Support\Str;

class StartPaymentRequest extends OrderSessionRequest
{
    protected function prepareForValidation(): void
    {
        parent::prepareForValidation();
        $this->merge(['idempotency_key' => Str::lower($this->header('Idempotency-Key', ''))]);
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'idempotency_key' => ['required', 'uuid'],
            'amount_cents' => ['missing'],
            'total_cents' => ['missing'],
            'payment_id' => ['missing'],
            'provider_payment_id' => ['missing'],
            'currency' => ['missing'],
            'status' => ['missing'],
            'user_id' => ['missing'],
        ];
    }
}
