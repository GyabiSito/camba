<?php

$configured = array_map(trim(...), explode(',', (string) env('CAMBA_TRUSTED_PROXY_IPS', '')));
// Do not accept wildcard or subnet entries; only the known ingress peers can forward client data.
$proxies = array_values(array_filter(
    $configured,
    static fn (string $ip): bool => filter_var($ip, FILTER_VALIDATE_IP) !== false,
));

if (env('APP_ENV') === 'production' && count($proxies) !== count($configured)) {
    throw new RuntimeException('CAMBA_TRUSTED_PROXY_IPS must list exact ingress IP addresses.');
}

return ['proxies' => $proxies];
