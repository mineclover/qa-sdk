#!/usr/bin/env node
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(packageRoot, 'public');
const args = process.argv.slice(2);
const checkMode = args.includes('--check');
const port = Number(readOption('--port', readOption('-p', '5220')));
const host = readOption('--host', '127.0.0.1');

const mimeByExtension = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function readOption(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
}

function publicPathFor(requestUrl = '/') {
  const url = new URL(requestUrl, 'http://localhost');
  const decoded = decodeURIComponent(url.pathname);
  const safePath = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const relativePath = safePath === '/' ? 'index.html' : safePath.replace(/^[/\\]/, '');
  const candidate = join(publicDir, relativePath);
  const publicRelative = relative(publicDir, candidate);

  if (publicRelative.startsWith('..') || publicRelative === '') {
    return join(publicDir, 'index.html');
  }

  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    return join(candidate, 'index.html');
  }

  return candidate;
}

function createStaticServer() {
  return createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end('Method Not Allowed');
      return;
    }

    const filePath = publicPathFor(request.url);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': mimeByExtension.get(extname(filePath)) ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  });
}

function listen(server, inputPort, inputHost) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(inputPort, inputHost, () => resolve(server.address()));
  });
}

async function runCheck() {
  const server = createStaticServer();
  const address = await listen(server, 0, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const index = await fetch(`${baseUrl}/`);
    const config = await fetch(`${baseUrl}/config.js`);
    const missing = await fetch(`${baseUrl}/missing.js`);

    assert(index.ok, 'index.html should be served');
    assert((await index.text()).includes('QA Shop'), 'index.html should contain the app title');
    assert(config.ok, 'config.js should be served');
    assert(missing.status === 404, 'unknown assets should return 404');

    console.log(`shop-web static server self-check passed (${baseUrl})`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (checkMode) {
  await runCheck();
} else {
  const server = createStaticServer();
  const address = await listen(server, port, host);
  const actualHost = address.address === '::' ? 'localhost' : address.address;
  console.log(`shop-web static server listening at http://${actualHost}:${address.port}`);
}
