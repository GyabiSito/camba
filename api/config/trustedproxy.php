<?php

return [
    // Do not accept wildcard or subnet entries; only the known ingress peers can forward client data.
    'proxies' => array_values(array_filter(
        array_map(trim(...), explode(',', (string) env('CAMBA_TRUSTED_PROXY_IPS', ''))),
        static fn (string $ip): bool => filter_var($ip, FILTER_VALIDATE_IP) !== false,
    )),
];
