<?php

namespace App\Actions\Identity;

use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ResetPasswordAction
{
    /** @param array{email: string, token: string, password: string} $data */
    public function execute(array $data): void
    {
        $status = DB::transaction(function () use ($data): string {
            User::query()->where('email', $data['email'])->lockForUpdate()->first(['id']);

            return Password::reset($data, function (User $user, string $password): void {
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
