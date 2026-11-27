param(
    [ValidateRange(1024, 65535)][int]$StorePort = 44970,
    [ValidateRange(1024, 65535)][int]$AdminPort = 44971
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$utf8 = [Text.UTF8Encoding]::new($false)
$OutputEncoding = $utf8
$saved = @{}
Push-Location $root
try {
    if ($StorePort -eq $AdminPort) { throw 'Use distinct loopback ports.' }
    $endpoint = $env:DOCKER_HOST
    if (-not $endpoint) {
        $endpoint = docker context inspect (docker context show) --format '{{.Endpoints.docker.Host}}'
        if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve the Docker endpoint.' }
    }
    if ($endpoint -notmatch '^(npipe|unix):') { throw 'Use only a local Docker context.' }
    $source = git rev-parse --verify HEAD
    if ($LASTEXITCODE -ne 0 -or $source -notmatch '^[a-f0-9]{40}$') { throw 'No Git revision.' }
    $dirty = git status --porcelain
    if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'The candidate must be a clean, committed checkout.' }
    if (-not (Test-Path -LiteralPath (Join-Path $root 'web/node_modules/@playwright/test'))) {
        throw 'Install the workspace Playwright dependency and Chromium first.'
    }
    foreach ($port in @($StorePort, $AdminPort)) {
        $probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
        try { $probe.Start() } finally { $probe.Stop() }
    }

    $suffix = [guid]::NewGuid().ToString('N').Substring(0, 10)
    $project = "camba-pg-candidate-$suffix"
    $work = Join-Path ([IO.Path]::GetTempPath()) $project
    New-Item -ItemType Directory -Path $work | Out-Null
    $snapshot = Join-Path $work 'checkout'
    $archive = Join-Path $work 'checkout.zip'
    git archive --format=zip --output=$archive $source api web
    if ($LASTEXITCODE -ne 0) { throw 'Cannot archive the committed build context.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $snapshot

    $appKey = [byte[]]::new(32)
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($appKey) } finally { $rng.Dispose() }
    $apiEnv = Join-Path $work 'api.env'
    [IO.File]::WriteAllLines($apiEnv, [string[]]@(
        'MAIL_MAILER=array', 'CAMBA_MP_ACCESS_TOKEN=', 'CAMBA_MP_COLLECTOR_ID=', 'CAMBA_MP_WEBHOOK_SECRET=',
        # An old env_file must not override the explicit production Compose connection.
        'DB_CONNECTION=mysql', 'DB_HOST=ignored.invalid', 'DB_PORT=3306', 'DB_URL=mysql://ignored.invalid/legacy'
    ), $utf8)
    $config = [ordered]@{
        CAMBA_API_IMAGE = "camba-pg-local/api:$source"
        CAMBA_STORE_IMAGE = "camba-pg-local/store:$source"
        CAMBA_ADMIN_IMAGE = "camba-pg-local/admin:$source"
        CAMBA_API_ENV_FILE = $apiEnv.Replace('\', '/')
        CAMBA_APP_KEY = 'base64:' + [Convert]::ToBase64String($appKey)
        CAMBA_APP_URL = "http://127.0.0.1:$StorePort"
        CAMBA_ADMIN_URL = "http://127.0.0.1:$AdminPort"
        CAMBA_SANCTUM_DOMAINS = "127.0.0.1:$StorePort,127.0.0.1:$AdminPort"
        # The loopback-only HTTP rehearsal does not trust forwarded headers.
        CAMBA_TRUSTED_PROXY_IPS = '192.0.2.5'
        CAMBA_STORE_ALLOWED_HOSTS = '127.0.0.1'
        CAMBA_DB_PASSWORD = [guid]::NewGuid().ToString('N')
        CAMBA_DB_ADMIN_PASSWORD = [guid]::NewGuid().ToString('N')
        CAMBA_REHEARSAL_STORE_PORT = "$StorePort"
        CAMBA_REHEARSAL_ADMIN_PORT = "$AdminPort"
        CAMBA_PG_FIXTURE_PASSWORD = [guid]::NewGuid().ToString('N')
    }
    $envFile = Join-Path $work 'compose.env'
    [IO.File]::WriteAllLines($envFile, [string[]]@(
        foreach ($key in $config.Keys) { "$key=$($config[$key])" }
    ), $utf8)
    foreach ($key in $config.Keys) {
        $saved[$key] = [Environment]::GetEnvironmentVariable($key)
        [Environment]::SetEnvironmentVariable($key, $config[$key])
    }

    $files = @('--project-name', $project, '--env-file', $envFile,
        '-f', 'infra/compose.prod.yml', '-f', 'infra/compose.rehearsal.yml')
    function Compose {
        docker compose @files @args
        if ($LASTEXITCODE -ne 0) { throw "Compose failed ($($args[0])) in $project." }
    }
    function Fixture([string]$phase) {
        Get-Content -Raw -LiteralPath 'infra/rehearsal/postgresql-fixture.php' |
            docker compose @files exec -T -e "CAMBA_PG_FIXTURE_PHASE=$phase" -e CAMBA_PG_FIXTURE_PASSWORD api-fpm php
        if ($LASTEXITCODE -ne 0) { throw "The guarded fixture failed at $phase." }
    }

    Write-Output "Revision: $source; isolated project: $project; environment: $envFile"
    $label = "org.opencontainers.image.revision=$source"
    foreach ($image in @(
        @{ tag = $config.CAMBA_API_IMAGE; path = 'api'; target = 'runtime' },
        @{ tag = $config.CAMBA_STORE_IMAGE; path = 'web'; target = 'store' },
        @{ tag = $config.CAMBA_ADMIN_IMAGE; path = 'web'; target = 'admin' }
    )) {
        docker build --label $label --target $image.target --tag $image.tag (Join-Path $snapshot $image.path)
        if ($LASTEXITCODE -ne 0) { throw "The $($image.target) build failed." }
        $labels = docker image inspect --format '{{json .Config.Labels}}' $image.tag | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0 -or $labels.'org.opencontainers.image.revision' -ne $source) {
            throw 'Image provenance does not match HEAD.'
        }
    }

    $render = Compose --profile release config --format json | ConvertFrom-Json
    foreach ($role in @('api-fpm', 'worker', 'scheduler', 'migrate')) {
        $db = $render.services.$role.environment
        if ($db.DB_CONNECTION -ne 'pgsql' -or $db.DB_HOST -ne 'postgres' -or
            $db.DB_PORT -ne '5432' -or $db.DB_URL -ne '' -or $db.DB_DATABASE -ne 'camba_v2' -or
            $db.DB_USERNAME -ne 'camba_v2' -or $db.DB_PASSWORD -ne $config.CAMBA_DB_PASSWORD) {
            throw "Invalid DB settings for $role."
        }
    }
    $pg = $render.services.postgres
    if ($pg.ports -or -not $render.networks.data.internal -or
        (@($pg.networks.PSObject.Properties.Name) -join ',') -ne 'data' -or
        -not ($pg.volumes | Where-Object target -eq '/var/lib/postgresql')) {
        throw 'PostgreSQL must use its private network and the pinned version''s parent data directory.'
    }
    Compose up -d --wait postgres redis
    @"
\set app_password $($config.CAMBA_DB_PASSWORD)
CREATE ROLE camba_v2 LOGIN PASSWORD :'app_password';
ALTER DATABASE camba_v2 OWNER TO camba_v2;
"@ | docker compose @files exec -T postgres psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
    if ($LASTEXITCODE -ne 0) { throw 'Cannot initialize the disposable application role.' }
    Compose --profile release run --rm --no-deps migrate
    Compose --profile release run --rm --no-deps migrate php artisan db:seed --class=GeographySeeder --force --no-interaction
    Compose up -d --wait api api-fpm worker scheduler store admin ingress
    Compose exec -T api-fpm php artisan migrate:status --no-interaction
    $processes = Compose top worker scheduler | Out-String
    if ($processes -notmatch 'artisan\s+queue:work' -or $processes -notmatch 'artisan\s+schedule:work') {
        throw 'The worker and scheduler processes must be running.'
    }
    Write-Output $processes
    Fixture seed
    node web/e2e/postgres-production-candidate.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Browser rehearsal failed.' }
    Fixture verify
    Compose ps
    Write-Output "Passed. The isolated candidate is running at $($config.CAMBA_APP_URL) and $($config.CAMBA_ADMIN_URL)."
    Write-Output "To stop only this candidate, run: docker compose -p $project --env-file '$envFile' -f infra/compose.prod.yml -f infra/compose.rehearsal.yml stop"
} finally {
    foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key, $saved[$key]) }
    Pop-Location
}
