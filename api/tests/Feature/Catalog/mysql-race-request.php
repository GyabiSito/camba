<?php

use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

if (PHP_SAPI !== 'cli' || getenv('APP_ENV') !== 'testing' || ! getenv('CAMBA_CATALOG_TEST_ADMIN') || ! getenv('CAMBA_CATALOG_TEST_MEDIA')) {
    exit(2);
}

require __DIR__.'/../../../vendor/autoload.php';
$app = require __DIR__.'/../../../bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

if (config('database.default') !== 'mysql' || config('database.connections.mysql.database') !== 'camba_v2_test'
    || config('database.connections.mysql.host') !== '127.0.0.1' || config('database.connections.mysql.url')
    || config('database.connections.mysql.unix_socket') || $app->configurationIsCached()) {
    exit(2);
}

config(['filesystems.disks.public.root' => getenv('CAMBA_CATALOG_TEST_MEDIA')]);
[$method, $uri, $body] = array_pad(json_decode($argv[1], true, flags: JSON_THROW_ON_ERROR), 3, []);
$files = ($body['photo'] ?? false) ? ['photos' => [UploadedFile::fake()->image('phone.png', 60, 40)]] : [];
$request = Request::create($uri, $method, [], [], $files, [
    'HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => $files ? 'multipart/form-data' : 'application/json',
], $files ? null : json_encode($body, JSON_THROW_ON_ERROR));
$app->instance('request', $request);
Auth::guard('web')->setUser(User::findOrFail(getenv('CAMBA_CATALOG_TEST_ADMIN')));
$connection = (int) DB::selectOne('SELECT CONNECTION_ID() AS id')->id;
$response = $kernel->handle($request);
echo json_encode([
    'connection' => $connection,
    'status' => $response->getStatusCode(),
    'body' => json_decode($response->getContent(), true, flags: JSON_THROW_ON_ERROR),
], JSON_THROW_ON_ERROR);
$kernel->terminate($request, $response);
