<?php

namespace App\Http\Requests\Identity;

use App\Rules\PasswordRules;

class ApplyPasswordReset extends LoginRequest
{
    public function rules(): array
    {
        return [
            'email' => ['prohibited'],
            'token' => ['required', 'string', 'max:1024'],
            'password' => [...PasswordRules::replacement(), 'confirmed'],
        ];
    }
}
