<?php

$storage = getenv('LARAVEL_STORAGE_PATH');
if (getenv('APP_ENV') !== 'e2e' || ! $storage || ! is_dir($storage)) {
    http_response_code(503);

    return;
}
// PHP's HTTP SAPI on Windows does not populate these like CLI seeding does.
// Laravel's storagePath() reads the superglobals before config loads.
$_ENV['LARAVEL_STORAGE_PATH'] = $_SERVER['LARAVEL_STORAGE_PATH'] = $storage;

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Local E2E equivalent of the production /storage mount, limited to test WebP paths.
if (preg_match('~^/storage/([a-z0-9/-]+\.webp)$~D', $path, $match)) {
    $file = $storage.'/app/public/'.$match[1];
    if (is_file($file)) {
        header('Content-Type: image/webp');
        readfile($file);
        return;
    }
    http_response_code(404);
    return;
}

require getcwd().'/public/index.php';
