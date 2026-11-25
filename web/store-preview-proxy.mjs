import { createServer, request as send } from 'node:http';
import { reqHandler } from './server/server.mjs';

// Local Docker build only: the browser keeps one origin for Laravel sessions and assets.
const routingOrigin = 'http://store-preview.invalid';
const apiOrigin = new URL(process.env.CAMBA_SSR_API_ORIGIN ?? 'http://api:8000');
if (apiOrigin.protocol !== 'http:' || apiOrigin.pathname !== '/' ||
    apiOrigin.username || apiOrigin.password || apiOrigin.search || apiOrigin.hash) {
  throw new Error('CAMBA_SSR_API_ORIGIN must be an internal HTTP origin.');
}
const apiPaths = /^\/(?:api|sanctum|storage|email\/verify)(?:\/|$)/;
const hopHeaders = [
  'connection', 'keep-alive', 'proxy-connection', 'proxy-authorization',
  'proxy-authenticate', 'te', 'trailer', 'transfer-encoding', 'upgrade',
];

function forwardHeaders(headers) {
  const excluded = new Set([
    ...hopHeaders,
    ...String(headers.connection ?? '').split(',').map((name) => name.trim().toLowerCase()),
  ]);
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !excluded.has(name)));
}

function forwardApi(req, res, path) {
  // The target is environment configuration; nothing from the request selects an upstream.
  const upstream = send({
    hostname: apiOrigin.hostname, port: apiOrigin.port || 80, method: req.method, path,
    headers: forwardHeaders(req.headers),
  }, (reply) => {
    res.writeHead(reply.statusCode ?? 502, forwardHeaders(reply.headers));
    reply.on('error', () => res.destroy());
    reply.pipe(res);
  });
  upstream.setTimeout(30_000, () => upstream.destroy(new Error('Local API timeout')));
  upstream.on('error', () => {
    if (res.headersSent) return res.destroy();
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message: 'La API local no está disponible.' }));
  });
  res.once('close', () => upstream.destroy());
  req.pipe(upstream);
}

createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url ?? '/', routingOrigin);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (url.origin === routingOrigin && apiPaths.test(url.pathname)) {
    forwardApi(req, res, url.pathname + url.search);
    return;
  }
  reqHandler(req, res, (error) => {
    if (res.headersSent) return res.end();
    if (error) console.error(error);
    res.statusCode = error ? 500 : 404;
    res.end();
  });
}).listen(Number(process.env.PORT ?? 4000), process.env.HOST ?? '127.0.0.1');
