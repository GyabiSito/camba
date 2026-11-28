<?php

namespace App\Http\Requests\Orders;

use Illuminate\Foundation\Http\FormRequest;

class OrderSessionRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        abort_unless($this->hasSession(), 400, 'The session is not available.');
    }
}
