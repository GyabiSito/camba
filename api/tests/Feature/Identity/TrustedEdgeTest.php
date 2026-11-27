<?php

namespace Tests\Feature\Identity;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class TrustedEdgeTest extends TestCase
{
    public function test_only_the_configured_proxy_can_forward_ip_and_scheme(): void
    {
        config(['trustedproxy.proxies' => ['192.0.2.5']]);
        Route::get('/_test/client', fn (Request $request): array => [
            'ip' => $request->ip(),
            'secure' => $request->isSecure(),
            'host' => $request->getHost(),
            'port' => $request->getPort(),
        ]);

        foreach (['198.51.100.10', '198.51.100.11'] as $client) {
            $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.5'])
                ->getJson('http://store.example.test/_test/client', [
                    'X-Forwarded-For' => $client,
                    'X-Forwarded-Proto' => 'https',
                    'X-Forwarded-Port' => '18443',
                    'X-Forwarded-Host' => 'wrong.example.test',
                ])->assertExactJson(['ip' => $client, 'secure' => true, 'host' => 'store.example.test', 'port' => 18443]);
        }

        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.6'])
            ->getJson('http://store.example.test/_test/client', [
                'X-Forwarded-For' => '198.51.100.10',
                'X-Forwarded-Proto' => 'https',
                'X-Forwarded-Port' => '18443',
            ])->assertExactJson(['ip' => '192.0.2.6', 'secure' => false, 'host' => 'store.example.test', 'port' => 80]);
    }
}
