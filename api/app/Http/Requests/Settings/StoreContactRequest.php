<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class StoreContactRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:120', 'not_regex:/[\x00-\x1F\x7F]/'],
            'email' => ['required', 'string', 'max:254', 'email:rfc', 'not_regex:/[\x00-\x1F\x7F]/'],
            'phone' => ['nullable', 'string', 'max:40', 'not_regex:/[\x00-\x1F\x7F]/'],
            'message' => ['required', 'string', 'min:10', 'max:2000'],
        ];
    }
}
