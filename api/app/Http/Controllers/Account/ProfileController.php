<?php

namespace App\Http\Controllers\Account;

use App\Actions\Identity\ChangeBuyerPassword;
use App\Http\Requests\Account\ChangePasswordRequest;
use App\Http\Resources\Identity\UserResource;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ProfileController
{
    public function updatePassword(ChangePasswordRequest $request, ChangeBuyerPassword $change): Response
    {
        $change->execute($request->user('web'), $request->validated('current_password'), $request->validated('password'));

        return response()->noContent();
    }

    public function update(Request $request): UserResource
    {
        $buyer = $request->user();
        $buyer->update($request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['missing'],
            'password' => ['missing'],
            'password_confirmation' => ['missing'],
            'role' => ['missing'],
            'user_id' => ['missing'],
        ]));

        return new UserResource($buyer);
    }
}
