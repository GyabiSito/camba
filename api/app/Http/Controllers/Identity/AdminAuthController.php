<?php

namespace App\Http\Controllers\Identity;

use App\Http\Requests\Identity\LoginRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AdminAuthController
{
    public function login(LoginRequest $request): Response
    {
        $guard = Auth::guard('admin');
        if (! $guard->attempt($request->validated())) {
            throw ValidationException::withMessages(['email' => 'El correo o la contraseña no son correctos.']);
        }

        $request->session()->put('password_hash_admin', $guard->hashPasswordForCookie($guard->user()->getAuthPassword()));

        return response()->noContent();
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user('admin')->only(['name', 'email'])], headers: [
            'Cache-Control' => 'no-store, private',
        ]);
    }

    public function logout(Request $request): Response
    {
        Auth::guard('admin')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}
