import assert from 'node:assert/strict';

const port = process.env.CAMBA_E2E_STORE_PORT ?? '43863';
assert.match(port, /^\d{4,5}$/);
const origin = `http://127.0.0.1:${port}`;
const html = await fetch(origin, { headers: { 'accept-encoding': 'identity' } });
assert.equal(html.status, 200);
const entry = (await html.text()).match(/<script[^>]+src="(main-[a-z\d]+\.js)"/i)?.[1];
assert.ok(entry, 'Compiled Angular entry point should be present in SSR HTML');

const headers = (encoding) => ({ 'accept-encoding': encoding });
const url = `${origin}/${entry}`;
const gzip = await fetch(url, { headers: headers('gzip') });
const identity = await fetch(url, { headers: headers('identity') });
assert.equal(gzip.status, 200);
assert.equal(identity.status, 200);
assert.equal(gzip.headers.get('content-encoding'), 'gzip');
assert.match(gzip.headers.get('vary') ?? '', /(?:^|,)\s*accept-encoding\s*(?:,|$)/i);
assert.equal(identity.headers.get('content-encoding'), null);
const original = await identity.bytes();
assert.deepEqual(await gzip.bytes(), original);
const range = await fetch(url, { headers: { ...headers('gzip'), range: 'bytes=0-31' } });
assert.equal(range.status, 206);
assert.equal(range.headers.get('content-encoding'), null);
assert.equal(range.headers.get('content-range'), `bytes 0-31/${original.length}`);
assert.deepEqual(await range.bytes(), original.slice(0, 32));
console.log(`Negotiated gzip and identity return identical ${entry} bytes`);
