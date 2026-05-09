#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function fail(message) {
  console.error(`RLSC version consistency failed: ${message}`);
  process.exitCode = 1;
}

const analysis = readJson('packages/rlsc-analysis/package.json');
const rlsc = readJson('packages/rlsc/package.json');
const perspective = readJson('packages/rlsc-perspective/package.json');
const rootPackage = readJson('package.json');

const expectedAnalysisRange = `^${analysis.version}`;

if (rlsc.dependencies?.['rlsc-analysis'] !== expectedAnalysisRange) {
  fail(
    `rlsc depends on rlsc-analysis ${rlsc.dependencies?.['rlsc-analysis']}, expected ${expectedAnalysisRange}`,
  );
}

if (perspective.dependencies?.['rlsc-analysis'] !== expectedAnalysisRange) {
  fail(
    `rlsc-perspective depends on rlsc-analysis ${perspective.dependencies?.['rlsc-analysis']}, expected ${expectedAnalysisRange}`,
  );
}

const override = rootPackage.pnpm?.overrides?.['rlsc-analysis'];
if (override !== 'link:packages/rlsc-analysis') {
  fail(`root pnpm override for rlsc-analysis is ${override ?? 'missing'}`);
}

const submoduleStatus = git(['submodule', 'status', '--recursive'])
  .split('\n')
  .filter(Boolean);
const requiredSubmodules = new Map([
  ['packages/rlsc', 'https://github.com/mineclover/rlsc.git'],
  ['packages/rlsc-analysis', 'https://github.com/mineclover/rlsc-analysis.git'],
]);

for (const [path, url] of requiredSubmodules) {
  const status = submoduleStatus.find((line) => line.includes(` ${path} `));
  if (!status) {
    fail(`missing submodule status for ${path}`);
    continue;
  }
  const marker = status[0];
  if (marker === '-') fail(`${path} is not initialized`);
  if (marker === '+') fail(`${path} checkout differs from the parent gitlink`);
  if (marker === 'U') fail(`${path} has merge conflicts`);

  const actualUrl = git(['config', '--file', '.gitmodules', `submodule.${path}.url`]);
  if (actualUrl !== url) fail(`${path} url is ${actualUrl}, expected ${url}`);

  const dirty = execFileSync('git', ['-C', path, 'status', '--short'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  if (dirty) fail(`${path} has uncommitted changes:\n${dirty}`);
}

if (!process.exitCode) {
  console.log(
    `RLSC version consistency ok: rlsc-analysis ${analysis.version}, rlsc ${rlsc.version}, rlsc-perspective ${perspective.version}`,
  );
}
