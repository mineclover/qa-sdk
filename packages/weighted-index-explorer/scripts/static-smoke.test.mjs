import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WeightedIndex, calcWeights } from "weighted-index";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");
const distRoot = join(packageRoot, "dist");

async function readDist(path) {
  return readFile(join(distRoot, path), "utf-8");
}

const indexHtml = await readDist("index.html");
for (const marker of [
  "<title>가중진법 탐색기</title>",
  'id="app"',
  'data-sheet="explorer"',
  'data-sheet="concept"',
  'data-sheet="address"',
  'data-sheet="version"',
  'data-sheet="filter"',
  'data-sheet="obfuscate"',
  'data-sheet="layout"',
  'data-sheet="multi"',
  'id="grid-container"',
  'id="status-shape"',
]) {
  assert.ok(indexHtml.includes(marker), `built index.html is missing ${marker}`);
}

const assetRefs = [...indexHtml.matchAll(/(?:src|href)="(?:\.\/|\/)(assets\/[^"]+)"/g)].map((match) => match[1]);
assert.ok(assetRefs.some((path) => path.endsWith(".js")), "built index.html must reference JS asset");
assert.ok(assetRefs.some((path) => path.endsWith(".css")), "built index.html must reference CSS asset");
await Promise.all(assetRefs.map((path) => readDist(path)));

const v1Shape = [8, 4, 5, 4];
const v2Shape = [10, 4, 5, 4];
const v3Shape = [10, 4, 6, 4];
assert.deepEqual(calcWeights(v1Shape), [80, 20, 4, 1], "v1 weights must match explorer formula");

const v1 = new WeightedIndex(v1Shape, ["resource", "action", "role", "env"]);
assert.equal(v1.size, 640);
assert.equal(v1.encode([1, 1, 1, 1]), 0);
assert.equal(v1.encode([1, 2, 1, 1]), 20);
assert.equal(v1.encode([1, 1, 2, 1]), 4);
assert.equal(v1.encode([1, 1, 1, 2]), 1);
assert.equal(v1.encode([8, 4, 5, 4]), 639);
assert.deepEqual(v1.decode(42), [1, 3, 1, 3]);

assert.equal(new WeightedIndex(v2Shape).size, 800);
assert.equal(new WeightedIndex(v3Shape).size, 960);

console.log(`weighted-index-explorer smoke ok: ${assetRefs.length} assets, v1 size ${v1.size}`);
