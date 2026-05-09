import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const smokeDir = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(smokeDir);
const repoRoot = dirname(dirname(packageDir));
const packDir = mkdtempSync(join(tmpdir(), 'rlsc-perspective-pack-'));
const consumerDir = mkdtempSync(join(tmpdir(), 'rlsc-perspective-consumer-'));

function run(command, args, cwd = repoRoot) {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function pack(filter) {
  run('pnpm', ['--filter', filter, 'pack', '--pack-destination', packDir]);
}

function findPackage(pattern) {
  const file = readdirSync(packDir).find((entry) => pattern.test(entry));
  if (!file) throw new Error(`packed archive not found for ${pattern}`);
  return join(packDir, file);
}

function installConsumer(perspectivePackage, analysisPackage) {
  writeFileSync(
    join(consumerDir, 'package.json'),
    JSON.stringify(
      {
        name: 'rlsc-perspective-consumer-smoke',
        version: '0.0.0',
        private: true,
        type: 'module',
        pnpm: {
          overrides: {
            'rlsc-analysis': `file:${analysisPackage}`,
          },
        },
        dependencies: {
          'rlsc-perspective': `file:${perspectivePackage}`,
          'happy-dom': '20.8.4',
        },
      },
      null,
      2,
    ),
  );
  run('pnpm', ['install', '--offline'], consumerDir);
}

function writeConsumerChecks() {
  writeFileSync(
    join(consumerDir, 'esm-check.mjs'),
    `
import { Window } from "happy-dom";
import { createPerspectiveViewer } from "rlsc-perspective";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.DOMMatrix = window.DOMMatrix;
globalThis.PointerEvent = window.PointerEvent;

const child = {
  id: "consumer-card",
  tag: "article",
  classes: [],
  rect: { x: 40, y: 48, width: 200, height: 100 },
  zIndex: 0,
  depth: 1,
  display: "block",
  position: "static",
  overflow: "visible",
  visible: true,
  identifier: {
    kind: "componentId",
    value: "ConsumerCard",
    componentId: "ConsumerCard",
    nodeId: "consumer-card"
  },
  attributes: { "data-component-id": "ConsumerCard" },
  children: []
};

const doc = {
  version: "1.0",
  viewport: { width: 640, height: 360 },
  url: "https://consumer.local",
  timestamp: new Date(0).toISOString(),
  root: {
    id: "root",
    tag: "main",
    classes: [],
    rect: { x: 0, y: 0, width: 640, height: 360 },
    zIndex: 0,
    depth: 0,
    display: "block",
    position: "static",
    overflow: "visible",
    visible: true,
    identifier: { kind: "nodeId", value: "root", nodeId: "root" },
    attributes: {},
    children: [child]
  },
  grid: { cellSize: 80, cols: 8, rows: 5, cells: [] },
  layers: [],
  relations: []
};

const container = document.createElement("div");
Object.defineProperty(container, "clientWidth", { value: 800 });
Object.defineProperty(container, "clientHeight", { value: 520 });
document.body.appendChild(container);

const viewer = createPerspectiveViewer(container, doc, {
  groupBy: "componentId",
  projectionMode: "orthographic"
});
viewer.setView("top");
viewer.setProjectionMode("perspective");
viewer.setProjectionMode("orthographic");

const nodes = container.querySelectorAll(".rlsc-css3d-node").length;
const perspective = container.querySelector(".rlsc-css3d-viewport")?.style.perspective;
viewer.dispose();

if (nodes !== 2) throw new Error(\`expected 2 CSS 3D nodes, got \${nodes}\`);
if (perspective !== "none") throw new Error(\`expected orthographic perspective none, got \${perspective}\`);

console.log(JSON.stringify({ mode: "esm", nodes, perspective }));
`,
  );

  writeFileSync(
    join(consumerDir, 'cjs-check.cjs'),
    `
const pkg = require("rlsc-perspective");
if (typeof pkg.createPerspectiveViewer !== "function") {
  throw new Error("createPerspectiveViewer CJS export missing");
}
console.log(JSON.stringify({ mode: "cjs", hasFactory: true }));
`,
  );
}

try {
  run('pnpm', ['--filter', 'rlsc-analysis', 'build']);
  run('pnpm', ['--filter', 'rlsc-perspective', 'build']);
  pack('rlsc-analysis');
  pack('rlsc-perspective');

  const analysisPackage = findPackage(/^rlsc-analysis-.+\.tgz$/);
  const perspectivePackage = findPackage(/^rlsc-perspective-.+\.tgz$/);
  installConsumer(perspectivePackage, analysisPackage);
  writeConsumerChecks();

  run('node', ['esm-check.mjs'], consumerDir);
  run('node', ['cjs-check.cjs'], consumerDir);

  const packedPackage = readJson(
    join(consumerDir, 'node_modules', '@qa-sdk', 'rlsc-perspective', 'package.json'),
  );
  console.log(
    JSON.stringify({
      package: packedPackage.name,
      version: packedPackage.version,
      consumerDir,
    }),
  );
} finally {
  if (process.env.RLSC_KEEP_SMOKE_DIRS !== '1') {
    rmSync(packDir, { recursive: true, force: true });
    rmSync(consumerDir, { recursive: true, force: true });
  } else {
    console.log(JSON.stringify({ packDir, consumerDir }));
  }
}
