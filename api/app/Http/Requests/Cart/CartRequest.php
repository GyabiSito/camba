<?php

namespace App\Http\Requests\Cart;

use Illuminate\Foundation\Http\FormRequest;

class CartRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        abort_unless($this->hasSession(), 400, 'The session is not available.');
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return $this->isMethod('PUT') ? [
            'quantity' => ['required', 'integer:strict', 'min:1', 'max:2147483647'],
            'user_id' => ['missing'],
            'cart_id' => ['missing'],
            'guest_session_hash' => ['missing'],
            'product_id' => ['missing'],
        ] : [];
    }
}
