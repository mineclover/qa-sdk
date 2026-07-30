#!/usr/bin/env node

import { spawn } from 'node:child_process';

const knownModes = new Set(['--parallel', '--serial', '--slow']);
let forwardedArgs = process.argv.slice(2);
if (forwardedArgs[0] === '--') forwardedArgs = forwardedArgs.slice(1);

const mode = knownModes.has(forwardedArgs[0] ?? '') ? forwardedArgs.shift() : '--serial';
const filters = forwardedArgs;

const SLOW_TEST_FILES = [
  'src/commands/git-conflicts.test.ts',
  'src/commands/def.test.ts',
  'src/commands/ontology.test.ts',
  'src/commands/dkg.e2e.test.ts',
  'src/commands/quality-smoke.e2e.test.ts',
  'src/commands/review.test.ts',
  'src/commands/git-scan.test.ts',
];
const STABILITY_TEST_FILES = ['src/lib/deterministic-label-inventory-determinism-live.test.ts'];

const args = [
  'vitest',
  'run',
  ...(mode !== '--parallel' ? ['--no-file-parallelism'] : []),
  // This suite performs two whole-repository scans and owns a separate stability budget.
  ...(mode === '--parallel' ? STABILITY_TEST_FILES.flatMap((file) => ['--exclude', file]) : []),
  ...(mode === '--slow' ? [...SLOW_TEST_FILES, ...STABILITY_TEST_FILES] : []),
  ...filters,
];

const child = spawn('corepack', ['pnpm', 'exec', ...args], {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
