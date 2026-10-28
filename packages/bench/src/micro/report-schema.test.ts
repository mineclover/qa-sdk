import { describe, expect, it } from 'vitest';
import { collectEnvironment, summarizeNs, validateReport } from './report-schema.js';
import type { BenchmarkReportV1 } from './report-schema.js';

function validReport(): BenchmarkReportV1 {
  return {
    schemaVersion: 1,
    suite: 'codec',
    createdAt: new Date(0).toISOString(),
    catalogId: 'demo',
    catalogDigest: null,
    environment: collectEnvironment(),
    cases: [
      {
        id: 'ok-case',
        status: 'ok',
        warm: true,
        iterations: 100,
        nsPerOp: { mean: 1, p50: 1, p95: 1, p99: 1 },
        opsPerSec: 1_000,
        heapDeltaBytesPerOp: null,
      },
      {
        id: 'skipped-case',
        status: 'skipped',
        skipReason: 'boom',
        warm: false,
        iterations: 10,
        nsPerOp: null,
        opsPerSec: null,
        heapDeltaBytesPerOp: null,
      },
    ],
  };
}

describe('report-schema', () => {
  it('percentile을 계산하고 표본이 100 미만이면 p99는 null', () => {
    const small = summarizeNs(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(small.p50).toBe(25);
    expect(small.p99).toBeNull();
    const large = summarizeNs(Array.from({ length: 1000 }, (_, i) => i + 1));
    expect(large.p99).toBe(990);
  });

  it('입력 순서와 무관하게 정렬 후 percentile을 계산한다', () => {
    const summary = summarizeNs([5, 1, 4, 2, 3]);
    expect(summary).toMatchObject({ mean: 3, p50: 3, p95: 5, p99: null });
  });

  it('빈 표본은 거부한다', () => {
    expect(() => summarizeNs([])).toThrow();
  });

  it('환경 정보에 하드웨어 필드를 포함한다', () => {
    const env = collectEnvironment();
    expect(env).toMatchObject({
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    });
    expect(env.cpus).toBeGreaterThan(0);
    expect(typeof env.cpuModel).toBe('string');
    expect(env.gcExposed).toBe(typeof globalThis.gc === 'function');
  });

  it('schemaVersion이 다르면 검증 실패', () => {
    expect(() => validateReport({ schemaVersion: 2 })).toThrow();
  });

  it('올바른 report는 그대로 통과한다', () => {
    const report = validReport();
    expect(validateReport(JSON.parse(JSON.stringify(report)))).toEqual(report);
  });

  it('ok case에 nsPerOp가 없으면 검증 실패', () => {
    const report = validReport();
    const broken = { ...report, cases: [{ ...report.cases[0], nsPerOp: null }] };
    expect(() => validateReport(broken)).toThrow(/nsPerOp/);
  });

  it('skipped case에 skipReason이 없으면 검증 실패', () => {
    const report = validReport();
    const { skipReason: _omit, ...withoutReason } = report.cases[1];
    expect(() => validateReport({ ...report, cases: [withoutReason] })).toThrow(/skipReason/);
  });

  it('environment 필드 타입이 틀리면 검증 실패', () => {
    const report = validReport();
    expect(() =>
      validateReport({ ...report, environment: { ...report.environment, cpus: '8' } }),
    ).toThrow(/environment\.cpus/);
  });
});
