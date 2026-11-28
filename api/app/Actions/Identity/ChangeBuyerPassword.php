<?php

namespace App\Actions\Identity;

use App\Models\CommerceNotice;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use SensitiveParameter;

class ChangeBuyerPassword
{
    public function execute(User $buyer, #[SensitiveParameter] string $current, #[SensitiveParameter] string $password): void
    {
        DB::transaction(function () use ($buyer, $current, $password): void {
            $account = $buyer->newQuery()->lockForUpdate()->findOrFail($buyer->getKey());
            if (! Hash::check($current, $account->getAuthPassword())) {
                throw ValidationException::withMessages(['current_password' => 'La contraseña actual no es correcta.']);
            }

            if (! hash_equals($current, $password)) {
                $account->update(['password' => $password]);
                CommerceNotice::query()->create([
                    'dedup_key' => 'mail:buyer_password_changed:'.Str::uuid(),
                    'channel' => 'mail',
                    'kind' => CommerceNotice::BUYER_PASSWORD_CHANGED,
                    'subject_type' => 'user',
                    'subject_id' => $account->id,
                    'source_hash' => hash('sha256', $account->getEmailForVerification()),
                    'state' => 'pending',
                    'available_at' => now(),
                ]);
            }
            // Sanctum stores the hash of the authenticated instance when saving this session.
            $buyer->refresh();
        }, 3);
    }
}
