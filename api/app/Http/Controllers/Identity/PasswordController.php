<?php

namespace App\Http\Controllers\Identity;

use App\Actions\Identity\ResetPasswordAction;
use App\Http\Requests\Identity\ApplyPasswordReset;
use App\Http\Requests\Identity\RequestPasswordReset;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Throwable;

class PasswordController
{
    public function requestLink(RequestPasswordReset $request): Response
    {
        try {
            Password::broker('users')->sendResetLink($request->validated());
        } catch (Throwable $exception) {
            Log::warning('Password reset dispatch failed.', ['exception_type' => $exception::class]);
        }

        return response()->noContent(202);
    }

    public function reset(ApplyPasswordReset $request, ResetPasswordAction $reset): Response
    {
        $reset->execute($request->validated());

        return response()->noContent();
    }
}
