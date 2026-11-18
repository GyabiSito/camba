<?php

namespace App\Actions\Identity;

use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Validation\ValidationException;

class RegisterBuyerAction
{
    /** @param array{name: string, email: string, password: string} $data */
    public function execute(array $data): User
    {
        try {
            $user = User::create($data);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['email' => 'Ya existe una cuenta con ese correo.']);
        }

        event(new Registered($user));

        return $user->refresh();
    }
}
