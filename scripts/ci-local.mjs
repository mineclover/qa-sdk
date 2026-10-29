#!/usr/bin/env node
/**
 * ci-local — GitHub workflow 검사와 핵심 패키지 테스트를 로컬에서 한 번에 실행한다.
 *
 * Usage:
 *   node scripts/ci-local.mjs              # 전체
 *   node scripts/ci-local.mjs --only=tests  # 그룹 하나만 (gates | tests | bench)
 *   node scripts/ci-local.mjs --skip=bench  # 그룹 제외 (쉼표 구분)
 *   node scripts/ci-local.mjs --list        # 실행할 단계만 출력
 *
 * - 단계는 순서대로 실행하고 실패해도 나머지를 계속 실행한 뒤 요약과 함께 exit 1
 * - 실패한 단계는 출력 끝부분을 보여 준다
 * - DATABASE_URL이 있으면 @qa-sdk/store PG integration 테스트도 함께 돈다 (없으면 skip)
 */
import { spawnSync } from 'node:child_process';

/** 회귀를 막아야 하는 패키지 — 빌드는 `...`로 의존 패키지까지 포함한다 */
const TEST_PACKAGES = [
  '@qa-sdk/core',
  '@qa-sdk/demo-tests',
  '@qa-sdk/ingest-server',
  '@qa-sdk/registry-service',
  '@qa-sdk/decode-service',
  '@qa-sdk/gateway',
  'gate-service',
  'query-service',
  '@qa-sdk/store',
  '@qa-sdk/codec-proto',
  '@qa-sdk/logger',
  '@qa-sdk/sdk',
  '@qa-sdk/browser',
  '@qa-sdk/browser-codec',
  '@qa-sdk/convergence',
  'dkg',
  'dkg-enrichment',
  '@qa-sdk/spec-core',
  'codegen-core',
  '@qa-sdk/bench',
  '@qa-sdk/cli',
];

const PNPM = ['corepack', 'pnpm'];
const CLI = ['node', 'packages/cli/dist/index.js'];

const STEPS = [
  // ── gates: .github/workflows의 검사 + 저장소 공통 게이트 ──
  {
    group: 'gates',
    name: 'build (cli·viz-3d 의존 포함)',
    cmd: [
      ...PNPM,
      '--workspace-concurrency=1',
      '--filter',
      '@qa-sdk/cli...',
      '--filter',
      '@qa-sdk/viz-3d...',
      'run',
      'build',
    ],
  },
  { group: 'gates', name: 'def sync', cmd: [...CLI, 'def', 'sync'] },
  { group: 'gates', name: 'def validate', cmd: [...CLI, 'def', 'validate'] },
  { group: 'gates', name: 'def scan-audit', cmd: [...CLI, 'def', 'scan-audit'] },
  { group: 'gates', name: 'codegen drift', cmd: ['node', 'scripts/catalog-codegen-drift.mjs'] },
  { group: 'gates', name: 'format (changed)', cmd: ['node', 'scripts/check-format.mjs'] },
  { group: 'gates', name: 'dependency boundaries', cmd: [...PNPM, 'arch:check'] },
  { group: 'gates', name: 'analysis OS verify', cmd: [...PNPM, 'arch:verify'] },
  // ── tests ──
  {
    group: 'tests',
    name: 'build (테스트 대상 의존 포함)',
    cmd: [
      ...PNPM,
      '--workspace-concurrency=1',
      ...TEST_PACKAGES.flatMap((pkg) => ['--filter', `${pkg}...`]),
      'run',
      'build',
    ],
  },
  ...TEST_PACKAGES.map((pkg) => ({
    group: 'tests',
    name: `test ${pkg}`,
    cmd: [...PNPM, '--filter', pkg, 'test'],
  })),
  // ── bench: bench.yml의 PR smoke와 같은 조건 ──
  {
    group: 'bench',
    name: 'microbench smoke',
    cmd: [
      'node',
      '--expose-gc',
      'packages/bench/dist/micro/cli.js',
      '--iterations',
      '500',
      '--cold',
      '--out',
      'benchmarks/results/ci-local.json',
    ],
  },
];

function parseArgs(argv) {
  const value = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  return {
    only: value('only')?.split(',').filter(Boolean),
    skip: value('skip')?.split(',').filter(Boolean) ?? [],
    list: argv.includes('--list'),
  };
}

function selectSteps({ only, skip }) {
  return STEPS.filter((step) => (!only || only.includes(step.group)) && !skip.includes(step.group));
}

function tail(text, lines = 40) {
  return text.split('\n').slice(-lines).join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const steps = selectSteps(args);
  if (steps.length === 0) {
    console.error('선택된 단계가 없습니다. --only/--skip 그룹: gates, tests, bench');
    process.exitCode = 1;
    return;
  }
  if (args.list) {
    for (const step of steps) console.log(`[${step.group}] ${step.name}: ${step.cmd.join(' ')}`);
    return;
  }

  const results = [];
  for (const step of steps) {
    const started = Date.now();
    process.stdout.write(`▶ [${step.group}] ${step.name} … `);
    const run = spawnSync(step.cmd[0], step.cmd.slice(1), {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, CI: process.env.CI ?? 'true' },
    });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const ok = run.status === 0 && !run.error;
    console.log(ok ? `✔ ${seconds}s` : `✖ ${seconds}s`);
    if (!ok) {
      console.log(tail(`${run.stdout ?? ''}\n${run.stderr ?? ''}\n${run.error?.message ?? ''}`));
    }
    results.push({ ...step, ok, seconds });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ci-local: ${results.length - failed.length}/${results.length} 통과 ===`);
  for (const r of failed) console.log(`  ✖ [${r.group}] ${r.name}`);
  if (failed.length > 0) process.exitCode = 1;
}

main();
