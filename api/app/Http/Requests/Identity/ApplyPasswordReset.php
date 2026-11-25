<?php

namespace App\Http\Requests\Identity;

class ApplyPasswordReset extends LoginRequest
{
    public function rules(): array
    {
        $rules = parent::rules();

        return [
            'email' => ['prohibited'],
            'token' => ['required', 'string', 'max:1024'],
            'password' => [...$rules['password'], 'min:12', 'confirmed'],
        ];
    }
}
