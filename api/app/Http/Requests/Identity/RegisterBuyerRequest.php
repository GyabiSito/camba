<?php

namespace App\Http\Requests\Identity;

class RegisterBuyerRequest extends LoginRequest
{
    public function rules(): array
    {
        $rules = parent::rules();

        return [
            ...$rules,
            'name' => ['required', 'string', 'max:120'],
            'email' => [...$rules['email'], 'unique:users,email'],
            'password' => [...$rules['password'], 'min:12', 'confirmed'],
            'role' => ['missing'],
        ];
    }
}
