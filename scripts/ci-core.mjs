#!/usr/bin/env node
/**
 * Low-spec pure-logic proof profile.
 *
 * Default: core + demo-snapshot + convergence only.
 * --with-dkg: add dkg + dkg-enrichment (currently pulls the SQLite/Drizzle closure).
 */
import { spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const withDkg = args.has('--with-dkg');
const listOnly = args.has('--list');
const unknown = [...args].filter((arg) => !['--with-dkg', '--list'].includes(arg));

if (unknown.length > 0) {
  console.error(`Unknown option: ${unknown.join(', ')}`);
  process.exit(2);
}

const steps = [
  { package: '@qa-sdk/core', command: ['test'] },
  { package: '@qa-sdk/core', command: ['typecheck'] },
  { package: 'demo-snapshot', command: ['test'] },
  { package: 'demo-snapshot', command: ['build'] },
  { package: '@qa-sdk/convergence', command: ['test'] },
  { package: '@qa-sdk/convergence', command: ['build'] },
  { package: 'index-meta', command: ['test'] },
  { package: 'index-meta', command: ['typecheck'] },
  { package: 'index-meta', command: ['build'] },
  ...(withDkg
    ? [
        { package: 'dkg', command: ['test'] },
        { package: 'dkg-enrichment', command: ['test'] },
      ]
    : []),
];

if (listOnly) {
  for (const step of steps) console.log(`${step.package}: ${step.command.join(' ')}`);
  process.exit(0);
}

const startedAt = Date.now();
const failures = [];
for (const step of steps) {
  const label = `${step.package} ${step.command.join(' ')}`;
  process.stdout.write(`▶ ${label} … `);
  const result = spawnSync('corepack', ['pnpm', '--filter', step.package, ...step.command], {
    stdio: 'inherit',
    env: { ...process.env, CI: process.env.CI ?? 'true' },
  });
  if (result.status === 0) {
    console.log('✔');
  } else {
    console.log(`✖ (exit ${result.status ?? 'unknown'})`);
    failures.push(label);
  }
}

console.log(
  `\n=== ci-core: ${steps.length - failures.length}/${steps.length} 통과 (${(
    (Date.now() - startedAt) /
    1000
  ).toFixed(1)}s) ===`,
);
if (withDkg) {
  console.log(
    '주의: --with-dkg는 현재 dkg/store의 Drizzle·SQLite dependency closure를 포함합니다.',
  );
}
if (failures.length > 0) {
  for (const failure of failures) console.log(`  ✖ ${failure}`);
  process.exitCode = 1;
}
