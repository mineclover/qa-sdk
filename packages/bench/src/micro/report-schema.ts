import { cpus } from 'node:os';

/**
 * microbench 결과 포맷 BenchmarkReportV1.
 *
 * 측정 수치와 함께 측정 조건(commit, runtime, 하드웨어, catalog digest, warm/cold)을 담아
 * 다른 실행과 비교할 수 있게 한다. 수치 비교는 같은 cpuModel끼리만 의미가 있다.
 */

/** p99를 계산할 최소 표본 수. 이보다 작으면 p99는 null */
export const MIN_SAMPLES_FOR_P99 = 100;

export interface BenchmarkEnvironment {
  readonly commitSha: string | null;
  readonly node: string;
  readonly platform: string;
  readonly arch: string;
  readonly cpuModel: string;
  readonly cpus: number;
  readonly gcExposed: boolean;
}

export interface NsSummary {
  readonly mean: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number | null;
}

export interface MicroCaseResult {
  /** 예: 'core.encodePrefix/service@v1' */
  readonly id: string;
  readonly status: 'ok' | 'skipped';
  readonly skipReason?: string;
  readonly warm: boolean;
  readonly iterations: number;
  readonly nsPerOp: NsSummary | null;
  readonly opsPerSec: number | null;
  /** gcExposed=false면 null */
  readonly heapDeltaBytesPerOp: number | null;
}

export interface BenchmarkReportV1 {
  readonly schemaVersion: 1;
  readonly suite: string;
  /** 비교용 메타데이터 (결과 동일성 판정에는 쓰지 않음) */
  readonly createdAt: string;
  readonly catalogId: string;
  readonly catalogDigest: string | null;
  readonly environment: BenchmarkEnvironment;
  readonly cases: readonly MicroCaseResult[];
}

/** nearest-rank percentile. sorted는 오름차순 정렬된 비어 있지 않은 배열 */
function nearestRank(sorted: readonly number[], p: number): number {
  const index = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

/** ns 표본을 mean/p50/p95/p99로 요약. 표본이 MIN_SAMPLES_FOR_P99 미만이면 p99는 null */
export function summarizeNs(samples: readonly number[]): NsSummary {
  if (samples.length === 0) {
    throw new Error('summarizeNs: 표본이 비어 있다');
  }
  const sorted = [...samples].sort((a, b) => a - b);
  let total = 0;
  for (const sample of sorted) total += sample;
  return {
    mean: total / sorted.length,
    p50: nearestRank(sorted, 50),
    p95: nearestRank(sorted, 95),
    p99: sorted.length < MIN_SAMPLES_FOR_P99 ? null : nearestRank(sorted, 99),
  };
}

/**
 * 현재 프로세스의 측정 환경.
 * commitSha는 CI의 GITHUB_SHA만 읽는다. 로컬 실행에서는 CLI가 git으로 보강한다.
 */
export function collectEnvironment(): BenchmarkEnvironment {
  const cpuList = cpus();
  return {
    commitSha: process.env.GITHUB_SHA ?? null,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuModel: cpuList[0]?.model ?? 'unknown',
    cpus: cpuList.length,
    gcExposed: typeof globalThis.gc === 'function',
  };
}

// ── 검증 ──────────────────────────────────────────────────────────────────────

type Field = Record<string, unknown>;

function fail(path: string, expected: string, actual: unknown): never {
  throw new Error(`invalid BenchmarkReportV1: ${path}는 ${expected}여야 한다 (받은 값: ${JSON.stringify(actual)})`);
}

function asObject(value: unknown, path: string): Field {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'object', value);
  return value as Field;
}

function expectString(obj: Field, key: string, path: string): void {
  if (typeof obj[key] !== 'string') fail(`${path}.${key}`, 'string', obj[key]);
}

function expectNullableString(obj: Field, key: string, path: string): void {
  if (obj[key] !== null && typeof obj[key] !== 'string') fail(`${path}.${key}`, 'string | null', obj[key]);
}

function expectFiniteNumber(obj: Field, key: string, path: string): void {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${path}.${key}`, 'finite number', v);
}

function expectNullableNumber(obj: Field, key: string, path: string): void {
  if (obj[key] !== null) expectFiniteNumber(obj, key, path);
}

function expectBoolean(obj: Field, key: string, path: string): void {
  if (typeof obj[key] !== 'boolean') fail(`${path}.${key}`, 'boolean', obj[key]);
}

function validateEnvironment(value: unknown): void {
  const path = 'environment';
  const env = asObject(value, path);
  expectNullableString(env, 'commitSha', path);
  for (const key of ['node', 'platform', 'arch', 'cpuModel']) expectString(env, key, path);
  if (!Number.isInteger(env.cpus) || (env.cpus as number) < 1) fail(`${path}.cpus`, 'positive integer', env.cpus);
  expectBoolean(env, 'gcExposed', path);
}

function validateCase(value: unknown, index: number): void {
  const path = `cases[${index}]`;
  const c = asObject(value, path);
  expectString(c, 'id', path);
  expectBoolean(c, 'warm', path);
  if (!Number.isInteger(c.iterations) || (c.iterations as number) < 1) {
    fail(`${path}.iterations`, 'positive integer', c.iterations);
  }
  expectNullableNumber(c, 'opsPerSec', path);
  expectNullableNumber(c, 'heapDeltaBytesPerOp', path);

  if (c.status === 'ok') {
    const ns = asObject(c.nsPerOp, `${path}.nsPerOp`);
    for (const key of ['mean', 'p50', 'p95']) expectFiniteNumber(ns, key, `${path}.nsPerOp`);
    expectNullableNumber(ns, 'p99', `${path}.nsPerOp`);
    if (c.skipReason !== undefined) fail(`${path}.skipReason`, 'undefined (status=ok)', c.skipReason);
  } else if (c.status === 'skipped') {
    expectString(c, 'skipReason', path);
    if (c.nsPerOp !== null) fail(`${path}.nsPerOp`, 'null (status=skipped)', c.nsPerOp);
    if (c.opsPerSec !== null) fail(`${path}.opsPerSec`, 'null (status=skipped)', c.opsPerSec);
    if (c.heapDeltaBytesPerOp !== null) {
      fail(`${path}.heapDeltaBytesPerOp`, 'null (status=skipped)', c.heapDeltaBytesPerOp);
    }
  } else {
    fail(`${path}.status`, "'ok' | 'skipped'", c.status);
  }
}

/** 외부 입력(JSON 파일 등)을 BenchmarkReportV1로 검증. 실패 시 첫 위반 경로를 담아 throw */
export function validateReport(value: unknown): BenchmarkReportV1 {
  const report = asObject(value, 'report');
  if (report.schemaVersion !== 1) fail('report.schemaVersion', '1', report.schemaVersion);
  expectString(report, 'suite', 'report');
  expectString(report, 'createdAt', 'report');
  if (Number.isNaN(Date.parse(report.createdAt as string))) {
    fail('report.createdAt', 'ISO-8601 timestamp', report.createdAt);
  }
  expectString(report, 'catalogId', 'report');
  expectNullableString(report, 'catalogDigest', 'report');
  validateEnvironment(report.environment);

  if (!Array.isArray(report.cases)) fail('report.cases', 'array', report.cases);
  const seen = new Set<string>();
  report.cases.forEach((c: unknown, i: number) => {
    validateCase(c, i);
    const { id, warm } = c as MicroCaseResult;
    const key = `${id}#${warm ? 'warm' : 'cold'}`;
    if (seen.has(key)) fail(`cases[${i}]`, `고유한 (id, warm) 조합`, key);
    seen.add(key);
  });
  return value as BenchmarkReportV1;
}
