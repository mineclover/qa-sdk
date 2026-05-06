#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const packDir = '/tmp/rlsc-pack';
const consumerDir = mkdtempSync(join(tmpdir(), 'rlsc-tgz-consumer-'));

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd ?? root,
    stdio: 'inherit',
    env: process.env,
  });
}

function findPackage(pattern) {
  const match = readdirSync(packDir).find((name) => pattern.test(name));
  if (!match) throw new Error(`missing package matching ${pattern} in ${packDir}`);
  return join(packDir, match);
}

try {
  run('pnpm', ['pack:rlsc:local', packDir]);

  const analysisPackage = findPackage(/^qa-sdk-rlsc-analysis-.+\.tgz$/);
  const perspectivePackage = findPackage(/^qa-sdk-rlsc-perspective-.+\.tgz$/);
  const rlscPackage = findPackage(/^rlsc-.+\.tgz$/);

  writeFileSync(
    join(consumerDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'rlsc-tgz-consumer',
        private: true,
        type: 'module',
        pnpm: {
          overrides: {
            '@qa-sdk/rlsc-analysis': `file:${analysisPackage}`,
          },
        },
      },
      null,
      2,
    )}\n`,
  );

  run('pnpm', ['add', analysisPackage, perspectivePackage, rlscPackage], { cwd: consumerDir });
  run('pnpm', ['add', '-D', 'typescript', 'happy-dom'], { cwd: consumerDir });

  writeFileSync(
    join(consumerDir, 'esm-smoke.mjs'),
    `import { Window } from 'happy-dom';
import { scanScreen } from '@qa-sdk/rlsc-analysis/browser';
import { createPerspectiveViewer } from '@qa-sdk/rlsc-perspective';
import { renderToSVG } from 'rlsc/rendering';

const window = new Window({ url: 'https://example.test/' });
globalThis.window = window;
globalThis.document = window.document;
globalThis.Element = window.Element;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Node = window.Node;
globalThis.DOMMatrix = window.DOMMatrix;
globalThis.DOMPoint = window.DOMPoint;
globalThis.DOMRect = window.DOMRect;
globalThis.MutationObserver = window.MutationObserver;
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

document.body.innerHTML = '<main data-qa-address="page:home"><section data-component-id="Hero"><button>Buy</button></section><div id="layers" style="width:800px;height:600px"></div></main>';

const result = scanScreen(document.body, {
  collect: { addressAttribute: 'data-qa-address', includeHidden: true, minSize: 0 },
});
const container = document.getElementById('layers');
const viewer = createPerspectiveViewer(container, result.doc, {
  overflowIssues: result.overflowIssues,
});
const svg = renderToSVG(result.doc);

if (!result.doc.root) throw new Error('scanScreen did not return a root node');
if (!container.querySelector('.rlsc-css3d-node')) throw new Error('perspective viewer did not render nodes');
if (!svg.includes('<svg')) throw new Error('renderToSVG did not return SVG');

viewer.dispose();
console.log('esm smoke ok', result.nodes.length);
`,
  );

  writeFileSync(
    join(consumerDir, 'cjs-smoke.cjs'),
    `const { analyzeAreas } = require('@qa-sdk/rlsc-analysis');
const { createPerspectiveViewer } = require('@qa-sdk/rlsc-perspective');
const { renderToSVG } = require('rlsc/rendering');

if (typeof analyzeAreas !== 'function') throw new Error('analysis CJS export missing');
if (typeof createPerspectiveViewer !== 'function') throw new Error('perspective CJS export missing');
if (typeof renderToSVG !== 'function') throw new Error('rendering CJS export missing');

console.log('cjs smoke ok');
`,
  );

  writeFileSync(
    join(consumerDir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ['type-smoke.ts'],
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    join(consumerDir, 'type-smoke.ts'),
    `import { analyzeAreas, type RLSCDocument } from '@qa-sdk/rlsc-analysis';
import { scanScreen } from '@qa-sdk/rlsc-analysis/browser';
import { createPerspectiveViewer, type PerspectiveViewerOptions } from '@qa-sdk/rlsc-perspective';
import { renderToSVG } from 'rlsc/rendering';

const options: PerspectiveViewerOptions = { projectionMode: 'orthographic' };
const doc = undefined as unknown as RLSCDocument;
analyzeAreas(doc);
renderToSVG(doc);
scanScreen(document.body);
createPerspectiveViewer(document.body, doc, options);
`,
  );

  run('pnpm', ['exec', 'node', 'esm-smoke.mjs'], { cwd: consumerDir });
  run('pnpm', ['exec', 'node', 'cjs-smoke.cjs'], { cwd: consumerDir });
  run('pnpm', ['exec', 'tsc', '--noEmit'], { cwd: consumerDir });

  console.log(
    process.env.RLSC_KEEP_TGZ_CONSUMER === '1'
      ? `RLSC tgz install smoke ok: ${consumerDir}`
      : 'RLSC tgz install smoke ok',
  );
} finally {
  if (process.env.RLSC_KEEP_TGZ_CONSUMER !== '1') {
    rmSync(consumerDir, { recursive: true, force: true });
  }
}
