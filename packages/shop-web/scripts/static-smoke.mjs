#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(packageRoot, 'public');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readRelative(path) {
  const absolutePath = join(packageRoot, path);
  assert(existsSync(absolutePath), `Missing required file: ${path}`);
  return readFileSync(absolutePath, 'utf8');
}

const indexHtml = readRelative('public/index.html');
const configJs = readRelative('public/config.js');
const redirects = readRelative('public/_redirects');
const wranglerToml = readRelative('wrangler.toml');
const packageJson = JSON.parse(readRelative('package.json'));

for (const file of ['public/qa-browser-sdk.js', 'public/viz-3d-core.js']) {
  assert(existsSync(join(packageRoot, file)), `Missing required bundle: ${file}`);
}

assert(
  existsSync(join(packageRoot, 'scripts/serve-public.mjs')),
  'Missing package-local static server',
);
assert(
  packageJson.scripts.dev === 'node scripts/serve-public.mjs',
  'dev script must use package-local static server',
);
assert(
  packageJson.scripts.start === 'node scripts/serve-public.mjs',
  'start script must use package-local static server',
);

const catalogLoaders = readdirSync(publicDir).filter((file) =>
  /^catalog-loader-.+\.js$/.test(file),
);
assert(catalogLoaders.length > 0, 'Missing catalog-loader bundle in public/');

for (const snippet of [
  'data-testid="login-submit"',
  'data-testid="product-list"',
  'data-testid="add-to-cart-btn"',
  'data-testid="checkout-btn"',
  'data-testid="pay-btn"',
  'monitor.emitWithCoords',
  'window.__QA_CONFIG__',
]) {
  assert(indexHtml.includes(snippet), `index.html missing smoke snippet: ${snippet}`);
}

for (const key of ['INGEST_URL', 'REGISTRY_URL', 'MONITOR_URL', 'ENV', 'REGION']) {
  assert(configJs.includes(key), `config.js missing key: ${key}`);
}

assert(redirects.includes('/v1/*'), '_redirects missing /v1/* proxy rule');
assert(
  wranglerToml.includes('pages_build_output_dir = "public"'),
  'wrangler.toml missing Pages public output',
);

console.log(`shop-web static smoke passed (${catalogLoaders.length} catalog loader bundle(s))`);
