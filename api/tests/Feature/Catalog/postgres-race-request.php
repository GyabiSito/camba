<?php

use App\Models\Admin;
use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

$realm = getenv('CAMBA_CATALOG_TEST_ACTOR_REALM');
if (PHP_SAPI !== 'cli' || getenv('APP_ENV') !== 'testing' || ! getenv('CAMBA_CATALOG_TEST_ACTOR') || ! getenv('CAMBA_CATALOG_TEST_MEDIA')
    || ! in_array($realm, ['admin', 'web'], true)) {
    exit(2);
}

require __DIR__.'/../../../vendor/autoload.php';
$app = require __DIR__.'/../../../bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

if (config('database.default') !== 'pgsql' || config('database.connections.pgsql.database') !== 'camba_demo_test'
    || config('database.connections.pgsql.host') !== 'postgres' || config('database.connections.pgsql.url')
    || $app->configurationIsCached()) {
    exit(2);
}

config(['filesystems.disks.public.root' => getenv('CAMBA_CATALOG_TEST_MEDIA')]);
[$method, $uri, $body, $headers] = array_pad(json_decode($argv[1], true, flags: JSON_THROW_ON_ERROR), 4, []);
$files = ($body['photo'] ?? false) ? ['photos' => [UploadedFile::fake()->image('phone.png', 60, 40)]] : [];
DB::selectOne("SELECT set_config('application_name', ?, false)", ['camba_catalog_contention_worker_'.getmypid()]);
$connection = (int) DB::selectOne('SELECT pg_backend_pid() AS id')->id;
$actor = ($realm === 'admin' ? Admin::class : User::class)::findOrFail(getenv('CAMBA_CATALOG_TEST_ACTOR'));
$gate = $argv[2] ?? '';
if ($gate === '' || ! is_dir($gate) || file_put_contents($gate.'/ready-'.$connection, 'ready') === false) {
    exit(2);
}
$deadline = microtime(true) + 30;
while (microtime(true) < $deadline) {
    clearstatcache(true, $gate.'/go');
    if (file_exists($gate.'/go')) {
        break;
    }
    usleep(20000);
}
clearstatcache(true, $gate.'/go');
if (! file_exists($gate.'/go')) {
    exit(2);
}
$request = Request::create($uri, $method, [], [], $files, [
    'HTTP_ACCEPT' => 'application/json', 'HTTP_ORIGIN' => 'http://localhost',
    'CONTENT_TYPE' => $files ? 'multipart/form-data' : 'application/json',
], $files || $body === [] ? null : json_encode($body, JSON_THROW_ON_ERROR));
$request->headers->add($headers);
$app->instance('request', $request);
Auth::guard($realm)->setUser($actor);
$response = $kernel->handle($request);
echo json_encode([
    'connection' => $connection,
    'status' => $response->getStatusCode(),
    'body' => json_decode($response->getContent(), true, flags: JSON_THROW_ON_ERROR),
], JSON_THROW_ON_ERROR);
$kernel->terminate($request, $response);
