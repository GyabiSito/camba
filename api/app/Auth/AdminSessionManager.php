<?php

namespace App\Auth;

use Illuminate\Config\Repository;
use Illuminate\Foundation\Application;
use Illuminate\Session\SessionManager;

class AdminSessionManager extends SessionManager
{
    public const CSRF_COOKIE = 'CAMBA-ADMIN-XSRF-TOKEN';

    public function __construct(Application $app)
    {
        parent::__construct($app);
        $session = $this->getSessionConfig();
        // Buyer password resets may delete database sessions by numeric user_id.
        $this->config = new Repository(['session' => array_replace($session, [
            'driver' => 'database',
            'table' => 'admin_sessions',
            'cookie' => 'camba_admin_session',
            'path' => '/api/v1/admin',
            'domain' => null,
            'secure' => $app->isProduction() || $session['secure'],
        ])]);
    }
}
