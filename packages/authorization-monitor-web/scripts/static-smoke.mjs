#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distRoot = join(packageRoot, "dist");

function readText(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function assertFile(path) {
  assert.equal(existsSync(path), true, `${path} should exist`);
  assert.ok(statSync(path).size > 0, `${path} should not be empty`);
}

const indexHtml = readText(join(distRoot, "index.html"));
assert.match(indexHtml, /<main id="app"><\/main>/);
assert.match(indexHtml, /<script type="module" crossorigin src="\/assets\/[^"]+\.js"><\/script>/);
assert.match(indexHtml, /<link rel="stylesheet" crossorigin href="\/assets\/[^"]+\.css">/);

const assetPaths = [
  ...indexHtml.matchAll(/(?:src|href)="\/([^"]+\.(?:js|css))"/g),
].map((match) => match[1]);
assert.ok(assetPaths.length >= 2, "expected built JS and CSS assets");
for (const assetPath of assetPaths) {
  assertFile(join(distRoot, assetPath));
}

const sourceSnapshot = readJson(join(packageRoot, "public", "authorization-graph-snapshot.json"));
const bundledSnapshot = readJson(join(distRoot, "authorization-graph-snapshot.json"));
assert.equal(bundledSnapshot.graphId, sourceSnapshot.graphId);
assert.equal(bundledSnapshot.snapshotId, sourceSnapshot.snapshotId);
assert.equal(bundledSnapshot.graph.nodes.length, sourceSnapshot.graph.nodes.length);
assert.equal(bundledSnapshot.graph.relations.length, sourceSnapshot.graph.relations.length);
assert.ok(
  bundledSnapshot.graph.nodes.some((node) => node.coord?.taxonomies?.["resource_kind"] === "proxy_route"),
  "snapshot should include a proxy route resource",
);
assert.ok(
  bundledSnapshot.graph.nodes.some((node) => node.coord?.taxonomies?.["resource_kind"] === "domain_resource"),
  "snapshot should include a domain resource",
);

const bundleText = assetPaths
  .filter((assetPath) => assetPath.endsWith(".js"))
  .map((assetPath) => readText(join(distRoot, assetPath)))
  .join("\n");
assert.match(bundleText, /Authorization Ontology Monitor/);
assert.match(bundleText, /authz-monitor:surface:graph-canvas/);
assert.match(bundleText, /authz-monitor:surface:audit-summary/);
assert.match(bundleText, /ontology-graph-svg/);

console.log("authorization monitor web static smoke passed");
