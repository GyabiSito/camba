<?php

namespace App\Http\Requests\Identity;

class RequestPasswordReset extends LoginRequest
{
    public function rules(): array
    {
        return ['email' => parent::rules()['email']];
    }
}
