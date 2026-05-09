import { build } from 'esbuild';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workspaceRoot = new URL('../../..', import.meta.url).pathname;
const workDir = mkdtempSync(join(tmpdir(), 'rlsc-perspective-bundle-'));
const scopedModulesDir = join(workDir, 'node_modules', '@qa-sdk');
mkdirSync(scopedModulesDir, { recursive: true });
symlinkSync(
  join(workspaceRoot, 'packages', 'rlsc-analysis'),
  join(scopedModulesDir, 'rlsc-analysis'),
);
symlinkSync(
  join(workspaceRoot, 'packages', 'rlsc-perspective'),
  join(scopedModulesDir, 'rlsc-perspective'),
);

const cases = [
  {
    file: 'type-only.ts',
    code: `
import type { PerspectiveViewerOptions } from "rlsc-perspective";
export const projection = "orthographic" satisfies NonNullable<PerspectiveViewerOptions["projectionMode"]>;
console.log(projection);
`,
    maxBytes: 100,
    mustNotContain: ['rlsc-css3d', 'createPerspectiveViewer', 'analyzeAreas'],
  },
  {
    file: 'unused-perspective.ts',
    code: `
import { createPerspectiveViewer } from "rlsc-perspective";
console.log("consumer only");
`,
    maxBytes: 100,
    mustNotContain: ['rlsc-css3d', 'createPerspectiveViewer', 'analyzeAreas'],
  },
  {
    file: 'unused-analysis-browser.ts',
    code: `
import { collectLayoutWithText } from "rlsc-analysis/browser";
console.log("consumer only");
`,
    maxBytes: 100,
    mustNotContain: ['collectLayoutWithText', 'getComputedStyle', 'createAreaDocument'],
  },
  {
    file: 'perspective-runtime.ts',
    code: `
import { createPerspectiveViewer } from "rlsc-perspective";
console.log(typeof createPerspectiveViewer);
`,
    minBytes: 5000,
    mustContain: ['rlsc-css3d'],
    mustNotContain: ['collectLayoutWithText', 'getComputedStyle'],
  },
];

async function bundleCase(testCase) {
  const entry = join(workDir, testCase.file);
  const outfile = join(workDir, testCase.file.replace(/\.ts$/, '.js'));
  writeFileSync(entry, testCase.code);
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    treeShaking: true,
    minify: true,
    absWorkingDir: workDir,
    logLevel: 'silent',
  });

  const text = readFileSync(outfile, 'utf8');
  const bytes = Buffer.byteLength(text);
  if (testCase.maxBytes !== undefined && bytes > testCase.maxBytes) {
    throw new Error(`${testCase.file} expected <= ${testCase.maxBytes} bytes, got ${bytes}`);
  }
  if (testCase.minBytes !== undefined && bytes < testCase.minBytes) {
    throw new Error(`${testCase.file} expected >= ${testCase.minBytes} bytes, got ${bytes}`);
  }
  for (const value of testCase.mustContain ?? []) {
    if (!text.includes(value))
      throw new Error(`${testCase.file} expected bundled output to contain ${value}`);
  }
  for (const value of testCase.mustNotContain ?? []) {
    if (text.includes(value))
      throw new Error(`${testCase.file} expected bundled output to omit ${value}`);
  }
  return { file: testCase.file, bytes };
}

try {
  const results = [];
  for (const testCase of cases) results.push(await bundleCase(testCase));
  console.log(JSON.stringify({ mode: 'bundle-tree-shaking', results }));
} finally {
  if (process.env.RLSC_KEEP_SMOKE_DIRS !== '1') {
    rmSync(workDir, { recursive: true, force: true });
  } else {
    console.log(JSON.stringify({ workDir }));
  }
}
