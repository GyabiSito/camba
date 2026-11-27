<?php

namespace App\Http\Requests\Identity;

use App\Rules\PasswordRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class LoginRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        abort_unless($this->hasSession(), 400, 'La sesión no está disponible.');

        if (is_string($email = $this->input('email'))) {
            $this->merge(['email' => Str::lower(trim($email))]);
        }
    }

    /** @return array<string, list<string|\Closure>> */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:254'],
            'password' => PasswordRules::input(),
        ];
    }
}
