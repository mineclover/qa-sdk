import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const demoPath = fileURLToPath(new URL('../public/demo.html', import.meta.url));
const port = Number.parseInt(process.env.BLI_DEMO_PORT ?? '4173', 10);

if (!Number.isInteger(port) || port < 1 || port > 65_535)
  throw new Error('BLI_DEMO_PORT must be a valid TCP port.');

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  if (request.method !== 'GET' || (path !== '/' && path !== '/demo.html')) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(await readFile(demoPath));
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Browser Layout Inspector demo: http://127.0.0.1:${port}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
