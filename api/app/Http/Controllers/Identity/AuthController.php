<?php

namespace App\Http\Controllers\Identity;

use App\Actions\Identity\RegisterBuyerAction;
use App\Http\Requests\Identity\LoginRequest;
use App\Http\Requests\Identity\RegisterBuyerRequest;
use App\Http\Resources\Identity\UserResource;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController
{
    public function register(RegisterBuyerRequest $request, RegisterBuyerAction $register): UserResource
    {
        return new UserResource($register->execute($request->safe()->only(['name', 'email', 'password'])));
    }

    public function login(LoginRequest $request): Response
    {
        if (! Auth::guard('web')->attempt($request->validated())) {
            throw ValidationException::withMessages(['email' => 'El correo o la contraseña no son correctos.']);
        }

        $request->session()->regenerate();

        return response()->noContent();
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function logout(Request $request): Response
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    public function verify(string $id, string $hash): Response
    {
        $user = User::findOrFail($id);
        abort_unless(hash_equals(sha1($user->getEmailForVerification()), $hash), 403);

        if (! $user->hasVerifiedEmail() && $user->markEmailAsVerified()) {
            event(new Verified($user));
        }

        return response()->noContent();
    }
}
