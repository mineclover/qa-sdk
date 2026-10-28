#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { computeCatalogDigest } from '@qa-sdk/core';
import { DEMO_CATALOG } from 'demo-snapshot';
import { createCodecSuite } from './codec-suite.js';
import { measureCase } from './measure.js';
import { collectEnvironment, MIN_SAMPLES_FOR_P99, validateReport } from './report-schema.js';
import type { BenchmarkEnvironment, BenchmarkReportV1, MicroCaseResult } from './report-schema.js';

const SUITE = 'codec';
const DEFAULT_ITERATIONS = 10_000;
const SLOWEST_TABLE_SIZE = 10;

const HELP = `
qa-bench-micro — codec·envelope hot path microbench (BenchmarkReportV1 JSON 출력)

Usage:
  node --expose-gc qa-bench-micro [options]

Options:
  --iterations <n>        warm case당 측정 반복 수. 기본: ${DEFAULT_ITERATIONS}
  --cold                  warmup 없는 cold case를 별도로 추가 측정 (warm 측정보다 먼저 실행)
  --cold-iterations <n>   cold case당 측정 반복 수. 기본: ${MIN_SAMPLES_FOR_P99}
  --filter <substring>    case id에 substring이 포함된 case만 측정
  --out <path>            report 저장 경로. 기본: benchmarks/results/${SUITE}-<commit|timestamp>.json
  --help

--expose-gc 없이 실행하면 heapDeltaBytesPerOp는 null로 기록된다.
`;

function parsePositiveInt(name: string, input: string | undefined, fallback: number): number {
  if (input === undefined) return fallback;
  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${name}는 1 이상의 정수여야 한다 (받은 값: ${input})`);
  }
  return parsed;
}

/** CI는 GITHUB_SHA, 로컬은 git rev-parse HEAD. 둘 다 없으면 null */
function resolveCommitSha(env: BenchmarkEnvironment): string | null {
  if (env.commitSha) return env.commitSha;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function formatNs(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : value.toFixed(0);
}

function printSummary(report: BenchmarkReportV1, outPath: string): void {
  const ok = report.cases.filter((c) => c.status === 'ok');
  const skipped = report.cases.filter((c) => c.status === 'skipped');
  const slowest = [...ok]
    .sort((a, b) => (b.nsPerOp?.p50 ?? 0) - (a.nsPerOp?.p50 ?? 0))
    .slice(0, SLOWEST_TABLE_SIZE);

  console.log(`\n느린 case 상위 ${slowest.length}개 (p50 기준, ns/op)`);
  console.table(
    slowest.map((c) => ({
      id: c.id,
      mode: c.warm ? 'warm' : 'cold',
      p50: formatNs(c.nsPerOp?.p50),
      p95: formatNs(c.nsPerOp?.p95),
      p99: formatNs(c.nsPerOp?.p99),
      'ops/s': c.opsPerSec === null ? '-' : c.opsPerSec.toFixed(0),
      'heapΔ B/op': c.heapDeltaBytesPerOp === null ? '-' : c.heapDeltaBytesPerOp.toFixed(1),
    })),
  );

  console.log(`case: ok ${ok.length}, skipped ${skipped.length}`);
  for (const c of skipped) {
    console.log(`  skipped ${c.id} (${c.warm ? 'warm' : 'cold'}): ${c.skipReason}`);
  }
  console.log(`report: ${outPath}`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      iterations: { type: 'string' },
      cold: { type: 'boolean', default: false },
      'cold-iterations': { type: 'string' },
      filter: { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(HELP.trim());
    return;
  }

  const iterations = parsePositiveInt('iterations', values.iterations, DEFAULT_ITERATIONS);
  const coldIterations = parsePositiveInt(
    'cold-iterations',
    values['cold-iterations'],
    MIN_SAMPLES_FOR_P99,
  );
  const filter = values.filter;

  const baseEnv = collectEnvironment();
  const environment: BenchmarkEnvironment = { ...baseEnv, commitSha: resolveCommitSha(baseEnv) };
  if (!environment.gcExposed) {
    console.warn('경고: --expose-gc 없이 실행 중 — heapDeltaBytesPerOp는 null로 기록된다');
  }

  const suite = createCodecSuite(DEMO_CATALOG).filter(
    (c) => filter === undefined || c.id.includes(filter),
  );
  if (suite.length === 0) {
    throw new Error(`--filter "${filter}"에 해당하는 case가 없다`);
  }

  // cold는 warmup이 섞이지 않도록 warm 측정 전에 모두 실행한다
  const cases: MicroCaseResult[] = [];
  if (values.cold) {
    for (const c of suite)
      cases.push(measureCase({ id: c.id, warm: false, iterations: coldIterations, run: c.run }));
  }
  for (const c of suite) cases.push(measureCase({ id: c.id, warm: true, iterations, run: c.run }));

  const createdAt = new Date().toISOString();
  const report = validateReport({
    schemaVersion: 1,
    suite: SUITE,
    createdAt,
    catalogId: DEMO_CATALOG.id,
    catalogDigest: await computeCatalogDigest(DEMO_CATALOG),
    environment,
    cases,
  } satisfies BenchmarkReportV1);

  const stamp = environment.commitSha?.slice(0, 7) ?? createdAt.replace(/[:.]/g, '-');
  const outPath = resolve(values.out ?? `benchmarks/results/${SUITE}-${stamp}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

  printSummary(report, outPath);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
