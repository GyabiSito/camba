<?php

namespace App\Http\Middleware;

use App\Auth\AdminSessionManager;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Symfony\Component\HttpFoundation\Cookie;

class AdminRequestForgery extends PreventRequestForgery
{
    protected function newCookie($request, $config): Cookie
    {
        return new Cookie(
            AdminSessionManager::CSRF_COOKIE,
            $request->session()->token(),
            $this->availableAt(60 * $config['lifetime']),
            '/',
            null,
            $this->app->isProduction() || $config['secure'],
            httpOnly: false,
            sameSite: $config['same_site'] ?? null,
        );
    }
}
