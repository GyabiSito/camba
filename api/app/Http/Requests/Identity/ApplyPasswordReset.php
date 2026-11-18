<?php

namespace App\Http\Requests\Identity;

class ApplyPasswordReset extends LoginRequest
{
    public function rules(): array
    {
        $rules = parent::rules();

        return [
            'email' => $rules['email'],
            'token' => ['required', 'string', 'max:255'],
            'password' => [...$rules['password'], 'min:12', 'confirmed'],
        ];
    }
}
