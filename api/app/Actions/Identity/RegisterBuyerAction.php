<?php

namespace App\Actions\Identity;

use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Validation\ValidationException;
use Throwable;

class RegisterBuyerAction
{
    /**
     * @param  array{name: string, email: string, password: string}  $data
     * @return array{user: User, verification_queued: bool}
     */
    public function execute(array $data): array
    {
        try {
            $user = User::create($data);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['email' => 'Ya existe una cuenta con ese correo.']);
        }

        $queued = true;
        try {
            event(new Registered($user));
        } catch (Throwable $exception) {
            report($exception);
            $queued = false;
        }

        return ['user' => $user->refresh(), 'verification_queued' => $queued];
    }
}
