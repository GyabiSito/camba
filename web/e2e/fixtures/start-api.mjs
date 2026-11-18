import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const api = join(here, '..', '..', '..', 'api');
const ports = ['API', 'ADMIN', 'STORE'].map((name) => Number(process.env[`CAMBA_E2E_${name}_PORT`]));
if (ports.some((port) => !Number.isInteger(port) || port < 1024 || port > 65535) || new Set(ports).size !== 3) {
  throw new Error('The runner requires three distinct trusted loopback ports.');
}
const [apiPort, adminPort, storePort] = ports;
const mailPorts = ['SMTP', 'HTTP'].map((name) => process.env[`CAMBA_E2E_MAILPIT_${name}_PORT`]);
const mailEnabled = mailPorts.some(Boolean);
if (mailEnabled && (mailPorts.some((port) => !/^\d{4,5}$/.test(port ?? '') ||
  Number(port) < 1024 || Number(port) > 65535) || new Set([...ports, ...mailPorts.map(Number)]).size !== 5)) {
  throw new Error('Mailpit requires two other distinct trusted loopback ports.');
}
const base = realpathSync(tmpdir());
const scratch = mkdtempSync(join(base, 'camba-browser-'));
const db = join(scratch, 'browser.sqlite');
const storage = join(scratch, 'storage');
writeFileSync(db, '');
for (const dir of ['app/public', 'framework/cache/data', 'framework/sessions', 'framework/views', 'logs']) {
  mkdirSync(join(storage, dir), { recursive: true });
}

const env = {
  ...process.env,
  APP_ENV: 'e2e', APP_DEBUG: 'false', APP_LOCALE: 'es',
  APP_KEY: `base64:${randomBytes(32).toString('base64')}`,
  APP_URL: `http://127.0.0.1:${storePort}`,
  APP_CONFIG_CACHE: join(scratch, 'config.php'),
  APP_ROUTES_CACHE: join(scratch, 'routes.php'),
  LARAVEL_STORAGE_PATH: storage,
  DB_CONNECTION: 'sqlite', DB_URL: '', DB_DATABASE: db,
  SANCTUM_STATEFUL_DOMAINS: [apiPort, adminPort, storePort].map((port) => `127.0.0.1:${port}`).join(','),
  SESSION_DRIVER: 'database', SESSION_COOKIE: 'camba_browser_e2e', SESSION_DOMAIN: '',
  SESSION_SECURE_COOKIE: 'false', CACHE_STORE: 'file', QUEUE_CONNECTION: 'database',
  BCRYPT_ROUNDS: '4', MAIL_MAILER: 'array', CAMBA_MP_ACCESS_TOKEN: '', CAMBA_MP_WEBHOOK_SECRET: '',
  CAMBA_E2E_SYNTHETIC: 'yes', LOG_CHANNEL: 'single',
  ...(process.env.CAMBA_E2E_SHORT_SESSION === '1' && { SESSION_LIFETIME: '1', SESSION_EXPIRE_ON_CLOSE: 'false' }),
  ...(mailEnabled && {
    MAIL_MAILER: 'smtp', MAIL_HOST: '127.0.0.1', MAIL_PORT: mailPorts[0],
    MAIL_URL: 'null', MAIL_USERNAME: 'null', MAIL_PASSWORD: 'null', MAIL_SCHEME: 'smtp',
    MAIL_FROM_ADDRESS: 'browser@camba.test', MAIL_FROM_NAME: 'Camba Browser Fixture',
  }),
};
const loaded = spawnSync('php', ['-m'], { encoding: 'utf8' });
const extensions = loaded.stdout?.includes('pdo_sqlite') ? [] : ['-d', 'extension=pdo_sqlite'];

function cleanup() {
  try {
    const resolved = realpathSync(scratch);
    if (dirname(resolved) === base && basename(resolved).startsWith('camba-browser-')) {
      rmSync(resolved, { recursive: true, force: true });
    }
  } catch {
    // Windows may keep a process handle until the test process exits; no repository data is here.
    console.error(`Camba browser fixture directory retained: ${scratch}`);
  }
}
process.on('exit', cleanup);

for (const args of [['artisan', 'migrate', '--force', '--quiet'], [join(here, 'seed.php')]]) {
  const result = spawnSync('php', [...extensions, ...args], { cwd: api, env, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw result.error ?? new Error('Could not prepare the isolated SQLite fixture.');
}

const server = spawn('php', [...extensions, '-S', `127.0.0.1:${apiPort}`, '-t', 'public', join(here, 'router.php')], {
  cwd: api, env, stdio: 'inherit', windowsHide: true,
});
const worker = spawn('php', [...extensions, 'artisan', 'queue:work', 'database', '--sleep=1', '--tries=1'], {
  cwd: api, env, stdio: 'inherit', windowsHide: true,
});
for (const [child, sibling] of [[server, worker], [worker, server]]) {
  child.on('error', (error) => { console.error(error.message); sibling.kill(); process.exitCode = 1; });
  child.on('exit', (code) => { sibling.kill(); process.exitCode ||= code ?? 0; });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.kill(); worker.kill(); });
