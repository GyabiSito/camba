<?php

namespace App\Http\Middleware;

use App\Auth\AdminSessionManager;
use Closure;
use Illuminate\Session\Middleware\StartSession;

class StartAdminSession extends StartSession
{
    public function __construct(AdminSessionManager $manager)
    {
        parent::__construct($manager);
    }

    public function handle($request, Closure $next)
    {
        if (app()->isProduction()) {
            $host = parse_url((string) config('app.admin_url'), PHP_URL_HOST);
            abort_unless(is_string($host) && strcasecmp($request->getHost(), $host) === 0, 404);
        }

        return parent::handle($request, $next);
    }
}
