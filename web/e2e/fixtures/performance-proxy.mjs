import { createServer, request } from 'node:http';

const names = ['CAMBA_E2E_STORE_PORT', 'CAMBA_E2E_API_PORT', 'PORT'];
const ports = names.map((name) => Number(process.env[name]));
if (
  ports.some((port) => !Number.isInteger(port) || port < 1024 || port > 65535) ||
  new Set(ports).size !== 3
) {
  throw new Error('The lab proxy needs three different loopback ports.');
}
const [listen, api, ssr] = ports;

// The lab measures public reads only. Production routing and transport remain owned by its edge.
createServer((incoming, outgoing) => {
  const path = incoming.url ?? '/';
  if (
    !['GET', 'HEAD'].includes(incoming.method) ||
    !path.startsWith('/') ||
    path.startsWith('//')
  ) {
    outgoing.writeHead(405).end();
    return;
  }
  const port = /^\/(api|storage)\//.test(path) ? api : ssr;
  const target = request(
    {
      hostname: '127.0.0.1',
      port,
      path,
      method: incoming.method,
      headers: { ...incoming.headers, host: `127.0.0.1:${listen}` },
    },
    (response) => {
      outgoing.writeHead(response.statusCode, response.headers);
      response.pipe(outgoing);
    },
  );
  target.on('error', () => {
    if (!outgoing.headersSent) outgoing.writeHead(503);
    outgoing.end();
  });
  target.end();
}).listen(listen, '127.0.0.1');
