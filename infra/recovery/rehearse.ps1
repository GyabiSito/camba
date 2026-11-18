[CmdletBinding()]
param([Parameter(Mandatory)][string]$ApiImage)

$ErrorActionPreference = 'Stop'
$context = (docker context show)
if ($LASTEXITCODE -ne 0) { throw 'No Docker context.' }
$endpoint = (docker context inspect $context --format '{{.Endpoints.docker.Host}}')
if ($LASTEXITCODE -ne 0 -or $endpoint -notmatch '^(npipe:////\./pipe/|unix:///)') {
    throw 'The recovery rehearsal requires a local Docker socket.'
}

function Local-Docker([string[]]$Command, [int]$ExpectedExit = 0) {
    docker --context $context @Command
    if ($LASTEXITCODE -ne $ExpectedExit) {
        throw "Docker $($Command[0]) exited $LASTEXITCODE; expected $ExpectedExit."
    }
}

function Compose([string]$Side, [string[]]$Command, [int]$ExpectedExit = 0) {
    Local-Docker (@('compose', '-f', (Join-Path $PSScriptRoot 'compose.yml'), '--project-name', "$prefix-$Side",
        '--env-file', (Join-Path $scratch "$Side.env")) + $Command) $ExpectedExit
}

function Fixture([string]$Side, [string]$Phase, [int]$ExpectedExit = 0) {
    Compose $Side @('exec', '-T', 'api-fpm', 'php', '/tmp/camba-recovery-fixture.php', $Phase) $ExpectedExit
}

$imageId = Local-Docker @('image', 'inspect', '--format', '{{.Id}}', $ApiImage)
if ($imageId -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Use exactly one installed Camba API runtime image.' }
$token = [guid]::NewGuid().ToString('N').Substring(0, 8)
$prefix = "camba-recovery-$token"
$octets = '10.{0}.{1}' -f [Convert]::ToInt32($token.Substring(0, 2), 16), [Convert]::ToInt32($token.Substring(2, 2), 16)
$scratch = Join-Path ([IO.Path]::GetTempPath()) $prefix
New-Item -ItemType Directory -Path $scratch | Out-Null
$sides = @('source', 'target')
$volumes = @(Local-Docker @('volume', 'ls', '--format', '{{.Name}}'))
$containers = @(Local-Docker @('ps', '-a', '--format', '{{.Names}}'))
$networks = @(Local-Docker @('network', 'ls', '--format', '{{.Name}}'))
foreach ($side in $sides) {
    if ($volumes -match "^$prefix-$side(_|$)" -or $containers -match "^$prefix-$side(-|$)" -or $networks -match "^$prefix-$side(_|$)") {
        throw 'The rehearsal must use two new Docker projects and volumes.'
    }
    # ponytail: Two small private subnets avoid exhausting the daemon's default pool.
    # If one overlaps a custom network, Docker refuses the run; a new token picks another pair.
    $subnet = if ($side -eq 'source') { "$octets.0/28" } else { "$octets.16/28" }
    @("CAMBA_REHEARSAL_IMAGE=$imageId", "CAMBA_REHEARSAL_DB=camba_recovery_${token}_$side", "CAMBA_REHEARSAL_SUBNET=$subnet") |
        Set-Content -Encoding Ascii -LiteralPath (Join-Path $scratch "$side.env")
}

$dump = Join-Path $scratch 'database.sql'
$media = Join-Path $scratch 'media.tar'
$active = @()
$oldImage, $oldDb, $oldSubnet = $env:CAMBA_REHEARSAL_IMAGE, $env:CAMBA_REHEARSAL_DB, $env:CAMBA_REHEARSAL_SUBNET
$env:CAMBA_REHEARSAL_IMAGE = $null
$env:CAMBA_REHEARSAL_DB = $null
$env:CAMBA_REHEARSAL_SUBNET = $null
try {
    Write-Host "Projects: $prefix-source, $prefix-target. Evidence: $scratch. API: $imageId."
    foreach ($side in $sides) {
        $active += $side
        Compose $side @('up', '-d', '--wait', '--wait-timeout', '150', '--pull', 'never')
        Compose $side @('cp', (Join-Path $PSScriptRoot 'fixture.php'), 'api-fpm:/tmp/camba-recovery-fixture.php')
        $schema = "camba_recovery_${token}_$side"
        $mysql = @('exec', '-T', '-e', 'MYSQL_PWD=synthetic-root', 'mysql')
        $mysqlArgs = @('--user=root', '--database', $schema)
        $empty = Compose $side ($mysql + @('mysql', '--batch', '--skip-column-names') + $mysqlArgs +
            @('--execute=SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()'))
        if ($empty -cne '0') { throw "Refusing to use a non-empty $side schema." }

        if ($side -eq 'source') {
            Compose $side @('exec', '-T', 'api-fpm', 'php', 'artisan', 'migrate', '--no-interaction', '--force')
            Fixture $side 'seed'
            Fixture $side 'crash' 76
            Fixture $side 'before-expiry'
            Fixture $side 'stage-jobs'
            $source = Fixture $side 'snapshot'
            $source | Set-Content -Encoding Ascii -LiteralPath (Join-Path $scratch 'source.json')
            # Only the fixture has written to this network. No worker or scheduler runs on the source.
            Compose $side ($mysql + @('mysqldump', '--user=root', '--single-transaction', '--no-tablespaces',
                '--set-gtid-purged=OFF', '--skip-add-drop-table', '--result-file=/tmp/camba.sql', $schema))
            Compose $side @('exec', '-T', 'api-fpm', 'tar', '-C', 'storage/app', '-cf', '/tmp/camba-media.tar', 'public', 'private')
            Compose $side @('cp', 'mysql:/tmp/camba.sql', $dump)
            Compose $side @('cp', 'api-fpm:/tmp/camba-media.tar', $media)
            Compose $side @('stop')
        } else {
            Compose $side @('cp', $dump, 'mysql:/tmp/camba.sql')
            Compose $side @('cp', $media, 'api-fpm:/tmp/camba-media.tar')
            Compose $side ($mysql + @('mysql') + $mysqlArgs + @('--execute=source /tmp/camba.sql'))
            Compose $side @('exec', '-T', 'api-fpm', 'tar', '-C', 'storage/app', '-xf', '/tmp/camba-media.tar')
            $target = Fixture $side 'snapshot'
            $target | Set-Content -Encoding Ascii -LiteralPath (Join-Path $scratch 'target.json')
            if ($source -cne $target) { throw 'Restored DB records or media hashes do not match the backup source.' }
            Write-Host 'OK: restored table counts, migration list, decrypted order, stock, inbox/outbox/import and both media hashes'
        }
    }

    foreach ($path in @('up', 'ready')) {
        Compose target @('exec', '-T', 'api', 'curl', '-fsS', '-o', '/dev/null', "http://127.0.0.1:8080/$path")
        Write-Host "OK: target /$path"
    }
    Compose target @('exec', '-T', 'api', 'curl', '-fsS', '-o', '/tmp/recovery.png', 'http://127.0.0.1:8080/storage/drill/item.png')
    $served = Compose target @('exec', '-T', 'api', 'sha256sum', '/tmp/recovery.png')
    $private = Compose target @('exec', '-T', 'api', 'curl', '-sS', '-o', '/dev/null', '-w', '%{http_code}',
        'http://127.0.0.1:8080/storage/drill/private.txt')
    if (($served -split ' ')[0] -cne ($target | ConvertFrom-Json).public_hash -or $private -cne '404') {
        throw 'Restored public image or private media isolation check failed.'
    }
    Write-Host 'OK: restored public image served byte-for-byte; private media HTTP 404'
    Fixture target 'resume'
    Fixture target 'recover-jobs'
    Compose target @('exec', '-T', 'api-fpm', 'php', 'artisan', 'queue:work', 'redis', '--stop-when-empty', '--tries=3', '--timeout=90')
    Fixture target 'verify-jobs'
    $messages = Compose target @('exec', '-T', 'api-fpm', 'curl', '-fsS', 'http://mailpit:8025/api/v1/messages') | ConvertFrom-Json
    if ($messages.total -ne 1 -or $messages.messages[0].Subject -cne 'Camba: pago confirmado' -or
        $messages.messages[0].To[0].Address -cne 'buyer@example.test') {
        throw 'Mailpit did not capture exactly one eligible synthetic payment message.'
    }
    Write-Host 'OK: Mailpit captured one payment confirmation and no ambiguous replay'
    Get-FileHash -Algorithm SHA256 -LiteralPath $dump, $media | Format-Table -AutoSize
} finally {
    foreach ($side in $active) {
        try { Compose $side @('stop') } catch { Write-Warning "Could not stop $prefix-$side. Stop that project before reusing Docker resources." }
    }
    $env:CAMBA_REHEARSAL_IMAGE, $env:CAMBA_REHEARSAL_DB, $env:CAMBA_REHEARSAL_SUBNET = $oldImage, $oldDb, $oldSubnet
}
