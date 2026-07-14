import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..');
const distRoot = join(packageRoot, 'dist');
const publicRoot = join(packageRoot, 'public');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function readDist(path) {
  return readFile(join(distRoot, path), 'utf-8');
}

const indexHtml = await readDist('index.html');
for (const marker of [
  '<title>Registry DSL UI</title>',
  'id="app"',
  'data-tab="glossary"',
  'data-tab="prefix-builder"',
  'data-tab="dsl-builder"',
  'data-tab="file-map"',
  'id="prefix-builder-container"',
  'id="file-map-container"',
]) {
  assert.ok(indexHtml.includes(marker), `built index.html is missing ${marker}`);
}

const assetRefs = [...indexHtml.matchAll(/(?:src|href)="(?:\.\/|\/)(assets\/[^"]+)"/g)].map(
  (match) => match[1],
);
assert.ok(
  assetRefs.some((path) => path.endsWith('.js')),
  'built index.html must reference JS asset',
);
assert.ok(
  assetRefs.some((path) => path.endsWith('.css')),
  'built index.html must reference CSS asset',
);
await Promise.all(assetRefs.map((path) => readDist(path)));

const [publicReportRaw, distReportRaw] = await Promise.all([
  readFile(join(publicRoot, '__generated__/git-conflicts.e2e.json'), 'utf-8'),
  readDist('__generated__/git-conflicts.e2e.json'),
]);
assert.equal(
  sha256(distReportRaw),
  sha256(publicReportRaw),
  'git-conflicts.e2e.json must be copied into dist unchanged',
);

const report = JSON.parse(distReportRaw);
assert.equal(report.schemaVersion, 'git-conflicts-report/v1');
assert.equal(report.analysis.currentBranchName, 'main');
assert.ok(Array.isArray(report.workspaceScopes), 'workspaceScopes must be an array');
assert.ok(Array.isArray(report.currentScopes), 'currentScopes must be an array');
assert.ok(Array.isArray(report.safeScopes), 'safeScopes must be an array');
assert.ok(
  report.workspaceScopes.length > 0,
  'workspace conflict fixture must include workspace scopes',
);
assert.ok(report.safeScopes.length > 0, 'workspace conflict fixture must include safe scopes');

console.log(
  `registry-ui smoke ok: ${assetRefs.length} assets, ${report.workspaceScopes.length} workspace scopes`,
);
