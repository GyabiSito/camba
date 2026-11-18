<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Password;

class QueuedResetPassword extends ResetPassword implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public function shouldSend(User $user, string $channel): bool
    {
        return Password::tokenExists($user, $this->token);
    }
}
