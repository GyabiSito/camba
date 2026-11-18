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
const identity = await fetch(url, { headers: headers('identity') });
assert.equal(identity.status, 200);
assert.equal(identity.headers.get('content-encoding'), null);
const original = await identity.bytes();
for (const encoding of ['gzip', 'br']) {
  const compressed = await fetch(url, { headers: headers(encoding) });
  assert.equal(compressed.status, 200);
  assert.equal(compressed.headers.get('content-encoding'), encoding);
  assert.match(compressed.headers.get('vary') ?? '', /(?:^|,)\s*accept-encoding\s*(?:,|$)/i);
  assert.deepEqual(await compressed.bytes(), original);
}
const range = await fetch(url, { headers: { ...headers('gzip'), range: 'bytes=0-31' } });
assert.equal(range.status, 206);
assert.equal(range.headers.get('content-encoding'), null);
assert.equal(range.headers.get('content-range'), `bytes 0-31/${original.length}`);
assert.deepEqual(await range.bytes(), original.slice(0, 32));
console.log(`Negotiated gzip, Brotli and identity return identical ${entry} bytes; 206 range is uncompressed`);
