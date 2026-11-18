<?php

namespace App\Http\Controllers\Account;

use App\Http\Resources\Identity\UserResource;
use Illuminate\Http\Request;

class ProfileController
{
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
