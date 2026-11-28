<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RedirectEmailVerification
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        if ($request->prefers(['application/json', 'text/html']) !== 'text/html') {
            return $response;
        }

        $result = match ($response->getStatusCode()) {
            204 => 'confirmada',
            403, 404 => 'invalida',
            default => null,
        };

        return $result === null ? $response : redirect()->away(
            rtrim(config('app.url'), '/').'/cuenta?verificacion='.$result,
            Response::HTTP_SEE_OTHER,
            ['Cache-Control' => 'private, no-store', 'Referrer-Policy' => 'no-referrer'],
        );
    }
}
