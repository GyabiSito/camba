<?php

namespace App\Actions\Identity;

use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ResetPasswordAction
{
    /** @param array{token: string, password: string} $data */
    public function execute(array $data): void
    {
        try {
            $context = json_decode(Crypt::decryptString($data['token']), true);
        } catch (DecryptException) {
            $context = null;
        }
        $id = $context['password_reset_user'] ?? null;
        $token = $context['password_reset_token'] ?? null;
        if (! is_int($id) || ! is_string($token)) {
            throw ValidationException::withMessages(['token' => 'El enlace no es válido o ya caducó.']);
        }

        $status = DB::transaction(function () use ($id, $token, $data): string {
            $account = User::query()->lockForUpdate()->find($id);
            if (! $account) {
                return Password::INVALID_USER;
            }

            $credentials = [
                'id' => $id,
                'email' => $account->getEmailForPasswordReset(),
                'token' => $token,
                'password' => $data['password'],
            ];

            return Password::reset($credentials, function (User $user, string $password): void {
                $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
                if (config('session.driver') === 'database') {
                    DB::connection(config('session.connection'))->table(config('session.table'))
                        ->where('user_id', $user->getKey())->delete();
                }
                DB::afterCommit(fn () => event(new PasswordReset($user)));
            });
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['token' => 'El enlace no es válido o ya caducó.']);
        }
    }
}
