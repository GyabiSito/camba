<?php

namespace App\Http\Requests\Identity;

use App\Rules\PasswordRules;

class RegisterBuyerRequest extends LoginRequest
{
    public function rules(): array
    {
        $rules = parent::rules();

        return [
            ...$rules,
            'name' => ['required', 'string', 'max:120'],
            'email' => [...$rules['email'], 'unique:users,email'],
            'password' => [...PasswordRules::replacement(), 'confirmed'],
            'role' => ['missing'],
        ];
    }
}
