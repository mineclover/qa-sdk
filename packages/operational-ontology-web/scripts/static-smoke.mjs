#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distRoot = join(packageRoot, 'dist');

function readText(path) {
  return readFileSync(path, 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function assertFile(path) {
  assert.equal(existsSync(path), true, `${path} should exist`);
  assert.ok(statSync(path).size > 0, `${path} should not be empty`);
}

const indexHtml = readText(join(distRoot, 'index.html'));
assert.match(indexHtml, /<main id="app"><\/main>/);
assert.match(indexHtml, /<script type="module" crossorigin src="\/assets\/[^"]+\.js"><\/script>/);
assert.match(indexHtml, /<link rel="stylesheet" crossorigin href="\/assets\/[^"]+\.css">/);

const assetPaths = [...indexHtml.matchAll(/(?:src|href)="\/([^"]+\.(?:js|css))"/g)].map(
  (match) => match[1],
);
assert.ok(assetPaths.length >= 2, 'expected built JS and CSS assets');
for (const assetPath of assetPaths) {
  assertFile(join(distRoot, assetPath));
}

for (const sampleName of ['event-store', 'pipe-store', 'snapshot-store']) {
  const source = readJson(join(packageRoot, 'public', 'samples', `${sampleName}.json`));
  const bundled = readJson(join(distRoot, 'samples', `${sampleName}.json`));

  for (const key of ['objects', 'facets', 'observations', 'projections']) {
    assert.ok(Array.isArray(bundled[key]), `${sampleName}.${key} should be an array`);
    assert.equal(
      bundled[key].length,
      source[key].length,
      `${sampleName}.${key} should preserve source record count`,
    );
  }

  assert.ok(bundled.projections.length > 0, `${sampleName} should include projections`);
}

const bundleText = assetPaths
  .filter((assetPath) => assetPath.endsWith('.js'))
  .map((assetPath) => readText(join(distRoot, assetPath)))
  .join('\n');
assert.match(bundleText, /Operational Ontology Web/);
assert.match(bundleText, /Store metrics/);
assert.match(bundleText, /Scenario guide/);
assert.match(bundleText, /ontology-graph-svg/);

console.log('operational ontology web static smoke passed');
