import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import compression from 'compression';
import { join } from 'node:path';

const app = express();
const angular = new AngularNodeAppEngine();
app.disable('x-powered-by');
app.get('/healthz', (_request, response) => {
  response.set('Cache-Control', 'no-store').send('ok');
});
app.use(compression({
  filter: (request, response) => !request.headers.range && !response.hasHeader('Set-Cookie') &&
    compression.filter(request, response),
}));
app.use(express.static(join(import.meta.dirname, '../browser'), {
  maxAge: '1h',
  index: false,
  redirect: false,
}));
app.use((request, response, next) => {
  angular.handle(request)
    .then((result) => result ? writeResponseToNodeResponse(result, response) : next())
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  app.listen(Number(process.env['PORT'] ?? 4000), process.env['HOST'] ?? '127.0.0.1');
}

export const reqHandler = createNodeRequestHandler(app);
