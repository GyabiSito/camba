<?php

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;

Artisan::command('camba:grant-admin {email : Verified Camba account email}', function (string $email): int {
    $user = User::query()->where('email', Str::lower(trim($email)))->first();
    if (! $user?->hasVerifiedEmail()) {
        $this->error('A verified account is required.');

        return 1;
    }

    $user->forceFill(['role' => 'admin'])->save();
    $this->info('Administrator access is active for the selected account.');

    return 0;
})->purpose('Grant administrator access to an existing verified account from a trusted shell');
