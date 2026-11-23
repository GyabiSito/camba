<?php

declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

if (! in_array($argv[1] ?? '', explode("\0", (string) file_get_contents('/proc/1/cmdline')), true)) {
    exit(1);
}

require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

try {
    $connection = DB::connection();
    $database = $connection->selectOne('select current_database() as name');
    exit($connection->getDriverName() === 'pgsql' && $database?->name === 'camba_v2_demo'
        && (bool) Redis::connection()->ping() ? 0 : 1);
} catch (Throwable) {
    exit(1);
}
