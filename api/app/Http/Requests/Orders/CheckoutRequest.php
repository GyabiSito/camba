<?php

namespace App\Http\Requests\Orders;

use App\Logging\PaymentLog;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CheckoutRequest extends OrderSessionRequest
{
    protected function failedValidation(Validator $validator)
    {
        try {
            parent::failedValidation($validator);
        } catch (ValidationException $error) {
            PaymentLog::failure($this->routeIs('orders.store') ? 'checkout' : 'checkout.quote', PaymentLog::attempt(), $error);

            throw $error;
        }
    }

    protected function prepareForValidation(): void
    {
        parent::prepareForValidation();
        if ($this->routeIs('orders.store')) {
            $this->merge(['idempotency_key' => Str::lower($this->header('Idempotency-Key', ''))]);
        }
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        $rules = [
            'items' => ['required', 'array', 'list', 'min:1', 'max:50'],
            'items.*' => ['required', 'array:product_id,quantity'],
            'items.*.product_id' => ['required', 'integer:strict', 'min:1', 'max:9007199254740991', 'distinct:strict'],
            'items.*.quantity' => ['required', 'integer:strict', 'min:1', 'max:1000'],
            'user_id' => ['missing'],
            'owner_key' => ['missing'],
            'status' => ['missing'],
            'currency' => ['missing'],
            'subtotal_cents' => ['missing'],
            'shipping_cents' => ['missing'],
            'total_cents' => ['missing'],
        ];
        if (! $this->routeIs('orders.store')) {
            return [
                ...$rules,
                'address' => ['sometimes', 'required', 'array:department_id,locality_id'],
                'address.department_id' => ['required_with:address', 'integer:strict', 'min:1'],
                'address.locality_id' => ['required_with:address', 'integer:strict', 'min:1'],
            ];
        }

        return [
            ...$rules,
            'idempotency_key' => ['required', 'uuid'],
            'shipping_method' => ['required', 'in:pickup,delivery'],
            'quote_token' => ['required', 'string', 'size:64', 'regex:/\A[0-9a-f]{64}\z/'],
            'contact' => ['required', 'array:name,email,phone'],
            'contact.name' => ['required', 'string', 'max:120'],
            'contact.email' => ['required', 'email', 'max:254'],
            'contact.phone' => ['nullable', 'string', 'max:30'],
            'address' => ['missing_unless:shipping_method,delivery', 'required_if:shipping_method,delivery', 'array:recipient,department_id,locality_id,street,number,details,postal_code'],
            'address.recipient' => ['required_if:shipping_method,delivery', 'string', 'max:120'],
            'address.department_id' => ['required_if:shipping_method,delivery', 'integer:strict', 'min:1'],
            'address.locality_id' => ['required_if:shipping_method,delivery', 'integer:strict', 'min:1'],
            'address.street' => ['required_if:shipping_method,delivery', 'string', 'max:160'],
            'address.number' => ['required_if:shipping_method,delivery', 'string', 'max:20'],
            'address.details' => ['nullable', 'string', 'max:255'],
            'address.postal_code' => ['nullable', 'string', 'max:12'],
        ];
    }
}
