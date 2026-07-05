import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const [indexHtml, publicRaw, distRaw] = await Promise.all([
  readFile(join(packageRoot, "dist/index.html"), "utf-8"),
  readFile(join(packageRoot, "public/data.json"), "utf-8"),
  readFile(join(packageRoot, "dist/data.json"), "utf-8"),
]);

for (const marker of [
  "<title>QA-SDK",
  'id="sidebar"',
  'id="tree"',
  'id="detail"',
  'id="stats-view"',
  "fetch('/data.json')",
  "function navigate",
  "function renderStats",
]) {
  assert.ok(indexHtml.includes(marker), `built index.html is missing ${marker}`);
}

assert.equal(
  sha256(distRaw),
  sha256(publicRaw),
  "dist/data.json must be the exported definition snapshot copied from public/data.json",
);

const data = JSON.parse(distRaw);
assert.ok(Array.isArray(data.nodes), "data.json must expose nodes");
assert.equal(data.stats.total, data.nodes.length, "stats.total must match nodes.length");
assert.ok(data.nodes.length >= 1000, "docs explorer should export the real docs catalog");
assert.ok(data.stats.groups > 0, "docs explorer should include group nodes");

const byId = new Map(data.nodes.map((node) => [node.id, node]));
assert.equal(byId.size, data.nodes.length, "node ids must be unique");

const root = byId.get("system-root");
assert.ok(root, "system-root must be exported");
const rootTargets = root.contains.length > 0
  ? root.contains
  : root.links.map((link) => link.target).filter((id) => byId.has(id));
assert.ok(rootTargets.length > 0, "system-root must expose navigable child documents");

const explorerSpec = byId.get("docs-explorer");
assert.ok(explorerSpec, "docs-explorer spec node must be exported");
assert.equal(explorerSpec.ref, "docs/specs/docs-explorer/docs-explorer.md");
assert.ok(explorerSpec.purpose.length > 0, "docs-explorer spec should expose purpose text");

const surfaceRule = byId.get("package-surface-separation-rule");
assert.ok(surfaceRule, "package surface separation rule must be exported");
assert.equal(surfaceRule.ref, "docs/specs/system/package-surface-separation.rule.md");
assert.ok(surfaceRule.body.includes("Taxonomy tooling"), "surface rule must keep taxonomy tooling visible");
assert.ok(surfaceRule.body.includes("Profile contract tooling"), "surface rule must keep profile contract tooling visible");
assert.ok(
  surfaceRule.body.includes("runtime dependency가 아니라 adapter, fixture, smoke script, 또는 CLI 계약"),
  "surface rule must keep cross-surface integration out of runtime dependencies",
);

const brokenContains = [];
for (const node of data.nodes) {
  assert.ok(Array.isArray(node.contains), `${node.id} contains must be an array`);
  assert.ok(Array.isArray(node.parents), `${node.id} parents must be an array`);
  assert.ok(Array.isArray(node.links), `${node.id} links must be an array`);

  for (const childId of node.contains) {
    if (!byId.has(childId)) brokenContains.push(`${node.id} -> ${childId}`);
  }
  for (const parentId of node.parents) {
    if (!byId.has(parentId)) brokenContains.push(`${node.id} <- ${parentId}`);
  }
}

assert.deepEqual(brokenContains.slice(0, 5), [], "contains/parents must reference exported nodes");

console.log(`docs-explorer smoke ok: ${data.nodes.length} nodes, ${data.stats.groups} groups`);
