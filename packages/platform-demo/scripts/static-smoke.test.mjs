import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");
const distRoot = join(packageRoot, "dist");
const publicRoot = join(packageRoot, "public");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readDist(path) {
  return readFile(join(distRoot, path), "utf-8");
}

async function assertCopied(path) {
  const [source, built] = await Promise.all([
    readFile(join(publicRoot, path), "utf-8"),
    readDist(path),
  ]);
  assert.equal(sha256(built), sha256(source), `${path} must be copied into dist unchanged`);
  return built;
}

const indexHtml = await readDist("index.html");
for (const marker of [
  "<title>플랫폼 인덱스 데모</title>",
  'id="app"',
  'data-sheet="service"',
  'data-sheet="permission"',
  'data-sheet="event"',
  'data-sheet="prefix-meta"',
  'id="status-shape"',
]) {
  assert.ok(indexHtml.includes(marker), `built index.html is missing ${marker}`);
}

const assetRefs = [...indexHtml.matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g)].map((match) => match[1]);
assert.ok(assetRefs.some((path) => path.endsWith(".js")), "built index.html must reference JS asset");
assert.ok(assetRefs.some((path) => path.endsWith(".css")), "built index.html must reference CSS asset");
await Promise.all(assetRefs.map((path) => readDist(path)));

const copiedPaths = [
  "_redirects",
  "config.js",
  "dashboard.html",
  "debugger.html",
  "def-catalog-data.json",
  "demo-fallback-data.js",
  "diagram-presets.js",
  "diagram.html",
  "docs.html",
  "events.html",
  "flow.html",
  "insights.html",
  "monitor.html",
  "send-test-event.sh",
  "viz-3d-core.js",
];

const copied = Object.fromEntries(
  await Promise.all(copiedPaths.map(async (path) => [path, await assertCopied(path)])),
);

const pageMarkers = {
  "dashboard.html": ["<title>QA-SDK Dashboard</title>", "demo-fallback-data.js"],
  "monitor.html": ["<title>QA-SDK Coordinate Monitor</title>", '<canvas id="c"></canvas>'],
  "diagram.html": ["<title>QA-SDK Diagram Viewer</title>", "diagram-presets.js"],
  "events.html": ["<title>QA-SDK Event Explorer</title>", 'id="traceList"'],
  "insights.html": ["<title>QA-SDK Insights</title>", 'id="summaryGrid"'],
  "flow.html": ["<title>QA-SDK Flow</title>", "demo-fallback-data.js", 'id="canvasSurface"'],
  "debugger.html": ["<title>QA-SDK Dev Debugger</title>", 'id="trace-list"'],
};

for (const [path, markers] of Object.entries(pageMarkers)) {
  for (const marker of markers) {
    assert.ok(copied[path].includes(marker), `${path} is missing ${marker}`);
  }
}

const catalog = JSON.parse(copied["def-catalog-data.json"]);
assert.ok(Array.isArray(catalog.nodes), "def-catalog-data.json must expose nodes");
assert.equal(catalog.stats.total, catalog.nodes.length, "catalog stats.total must match nodes.length");
assert.ok(catalog.nodes.length >= 1000, "platform demo should ship the real definition catalog snapshot");
assert.ok(catalog.nodes.some((node) => node.id === "system-root"), "catalog snapshot must include system-root");

const catalogById = new Map(catalog.nodes.map((node) => [node.id, node]));
const surfaceRule = catalogById.get("package-surface-separation-rule");
assert.ok(surfaceRule, "catalog snapshot must include package surface separation rule");
assert.ok(surfaceRule.body.includes("Taxonomy tooling"), "surface rule must keep taxonomy tooling visible");
assert.ok(surfaceRule.body.includes("Profile contract tooling"), "surface rule must keep profile contract tooling visible");
assert.ok(
  surfaceRule.body.includes("runtime dependency가 아니라 adapter, fixture, smoke script, 또는 CLI 계약"),
  "surface rule must keep cross-surface integration out of runtime dependencies",
);

const fallbackSandbox = { window: {}, Date };
vm.runInNewContext(copied["demo-fallback-data.js"], fallbackSandbox);
const fallback = fallbackSandbox.window.__QA_DEMO_FALLBACK__;
assert.ok(fallback, "demo fallback data must register window.__QA_DEMO_FALLBACK__");
assert.ok(fallback.dashboard.flowMap.layers.schema.length > 0, "fallback dashboard must include schema nodes");
assert.ok(fallback.flow.intentLinks.length > 0, "fallback flow must include IntentLinks");
assert.ok(fallback.flow.recentTraces.length > 0, "fallback flow must include recent traces");

const diagramSandbox = { window: {} };
vm.runInNewContext(copied["diagram-presets.js"], diagramSandbox);
const presets = diagramSandbox.window.DIAGRAM_PRESETS;
assert.ok(presets, "diagram presets must register window.DIAGRAM_PRESETS");
assert.ok(presets["intent-links"].length > 0, "diagram presets must include IntentLink diagrams");
assert.ok(presets.dsl.length > 0, "diagram presets must include DSL diagrams");

console.log(`platform-demo smoke ok: ${assetRefs.length} assets, ${catalog.nodes.length} docs, ${fallback.flow.recentTraces.length} fallback traces`);
