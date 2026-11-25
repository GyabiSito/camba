<?php

namespace App\Actions\Identity;

use App\Models\CommerceNotice;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
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
        $user = DB::transaction(function () use ($data): User {
            try {
                $user = User::create($data);
            } catch (UniqueConstraintViolationException) {
                throw ValidationException::withMessages(['email' => 'Ya existe una cuenta con ese correo.']);
            }

            // The existing scheduler queues the welcome only after this transaction commits.
            CommerceNotice::query()->createOrFirst(['dedup_key' => 'mail:buyer_welcome:user:'.$user->id], [
                'channel' => 'mail',
                'kind' => CommerceNotice::BUYER_WELCOME,
                'subject_type' => 'user',
                'subject_id' => $user->id,
                'source_hash' => hash('sha256', $user->getEmailForVerification()),
                'state' => 'pending',
                'available_at' => now(),
            ]);

            return $user;
        }, 3);

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
