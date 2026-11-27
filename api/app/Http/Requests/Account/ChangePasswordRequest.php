<?php

namespace App\Http\Requests\Account;

use App\Rules\PasswordRules;
use Illuminate\Foundation\Http\FormRequest;

class ChangePasswordRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'current_password' => PasswordRules::input(),
            'password' => PasswordRules::replacement(),
            'password_confirmation' => ['bail', 'required', 'string', 'same:password'],
            'user_id' => ['missing'],
            'email' => ['missing'],
            'role' => ['missing'],
        ];
    }

    public function messages(): array
    {
        return ['password_confirmation.same' => 'Las contraseñas no coinciden.'];
    }
}
