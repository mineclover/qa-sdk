// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * prefix-stamp 테스트 — 패싯별 분리.
 *
 * 패싯:
 *   1. 파싱 — @prefix 스탬프 정규식, SDK 앵커 탐지
 *   2. resolve — version 결정 (manifest/VERSION_META/latest)
 *   3. drift — label-index 불일치 검증
 *   4. find — 표식 기반 탐색
 *   5. migrate — version 마이그레이션
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  prefixStamp,
  prefixDrift,
  prefixFind,
  prefixMigrate,
  prefixImpact,
} from './prefix-stamp.js';

// DEMO_CATALOG은 실제 카탈로그 사용
let DEMO_CATALOG: import('@qa-sdk/core').Catalog;

const TMP = join(tmpdir(), `qa-prefix-stamp-test-${Date.now()}`);

beforeEach(async () => {
  mkdirSync(TMP, { recursive: true });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const mod = await import('demo-snapshot');
  DEMO_CATALOG = mod.DEMO_CATALOG;
});

afterEach(() => {
  vi.restoreAllMocks();
  try {
    rmSync(TMP, { recursive: true, force: true });
  } catch {}
});

function getOutput(): string {
  const spy = console.log as unknown as { mock: { calls: unknown[][] } };
  return spy.mock.calls.map((c) => String(c[0])).join('\n');
}

function writeTestFile(name: string, content: string): string {
  const path = join(TMP, name);
  writeFileSync(path, content, 'utf-8');
  return path;
}

// ── 패싯 1: 스탬프 생성 (prefixStamp) ────────────────

describe('prefixStamp', () => {
  it('SDK 앵커 함수 탐지 → @prefix 스탬프 삽입', () => {
    const file = writeTestFile(
      'track-test.ts',
      [
        'function sendEvent() {',
        '  monitor.track({ service: { env: "prod", region: "kr" } });',
        '}',
      ].join('\n'),
    );

    prefixStamp(DEMO_CATALOG, { paths: [file], dryRun: true });
    const output = getOutput();
    expect(output).toContain('@prefix');
    expect(output).toContain('service');
  });

  it('이미 스탬프된 파일 → 중복 건너뜀', () => {
    const file = writeTestFile(
      'already-stamped.ts',
      [
        '// @prefix service:v1 — dims: [env:0, region:1, svc_name:2, namespace:3]',
        'function sendEvent() {',
        '  monitor.track({ service: { env: "prod" } });',
        '}',
      ].join('\n'),
    );

    prefixStamp(DEMO_CATALOG, { paths: [file], dryRun: true });
    const output = getOutput();
    expect(output).toContain('중복 건너뜀');
  });

  it('제외 패턴 파일(.test.ts) → 스킵', () => {
    const file = writeTestFile(
      'some-test.test.ts',
      ['monitor.track({ service: { env: "test" } });'].join('\n'),
    );

    prefixStamp(DEMO_CATALOG, { paths: [file], dryRun: true });
    const output = getOutput();
    // 스탬프 삽입 0건
    expect(output).toContain('0 삽입');
  });
});

// ── 패싯 2: drift 검증 (prefixDrift) ─────────────────

describe('prefixDrift', () => {
  it('올바른 스탬프 → 이슈 없음', () => {
    const file = writeTestFile(
      'clean.ts',
      [
        '// @prefix service:v1 — dims: [env:0, region:1, svc_name:2, namespace:3]',
        'function f() {}',
      ].join('\n'),
    );

    prefixDrift(DEMO_CATALOG, [file]);
    const output = getOutput();
    expect(output).not.toContain('ERROR');
  });

  it('index 불일치 → error', () => {
    const file = writeTestFile(
      'drift.ts',
      ['// @prefix service:v1 — dims: [env:99, region:1]', 'function f() {}'].join('\n'),
    );

    prefixDrift(DEMO_CATALOG, [file]);
    const output = getOutput();
    expect(output).toContain('index-mismatch');
  });

  it('존재하지 않는 prefix → unknown-prefix error', () => {
    const file = writeTestFile(
      'unknown.ts',
      ['// @prefix nonexistent_prefix:v1 — dims: [x:0]', 'function f() {}'].join('\n'),
    );

    prefixDrift(DEMO_CATALOG, [file]);
    const output = getOutput();
    expect(output).toContain('unknown-prefix');
  });

  it('version 뒤처짐 → version-behind warning', () => {
    // permission prefix는 v3까지 있음 — v1 스탬프면 version-behind
    const file = writeTestFile(
      'old-version.ts',
      ['// @prefix permission:v1 — dims: [role:0, action:1, resource:2]', 'function f() {}'].join(
        '\n',
      ),
    );

    prefixDrift(DEMO_CATALOG, [file]);
    const output = getOutput();
    expect(output).toContain('version-behind');
  });
});

// ── 패싯 3: find 탐색 (prefixFind) ───────────────────

describe('prefixFind', () => {
  it('특정 prefix 스탬프 탐색', () => {
    writeTestFile('a.ts', '// @prefix service:v1 — dims: [env:0]\nfunction a() {}');
    writeTestFile('b.ts', '// @prefix permission:v1 — dims: [role:0]\nfunction b() {}');

    // prefixFind는 process.cwd() 기반 — cwd를 변경하지 않고 호출만 검증
    // 실제 cwd에 스탬프가 없으면 빈 결과
    prefixFind(DEMO_CATALOG, 'service');
    // 에러 없이 실행되면 성공
  });

  it('summary 모드 실행', () => {
    prefixFind(DEMO_CATALOG, undefined, { summary: true });
    // 에러 없이 실행되면 성공
  });
});

// ── 패싯 4: impact 분석 (prefixImpact) ───────────────

describe('prefixImpact', () => {
  it('prefix 사용처 출력', () => {
    writeTestFile(
      'impact.ts',
      [
        '// @prefix service:v1 — dims: [env:0, region:1, svc_name:2, namespace:3]',
        'function trackService() {',
        '  monitor.track({ service: { env: "prod" } });',
        '}',
      ].join('\n'),
    );

    prefixImpact(DEMO_CATALOG, 'service');
    // 최소한 에러 없이 실행
  });
});

// ── 패싯 5: migrate (prefixMigrate) ──────────────────

describe('prefixMigrate', () => {
  it('존재하지 않는 prefix → 에러 메시지', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    prefixMigrate(DEMO_CATALOG, 'nonexistent', 'v1', 'v2', { dryRun: true });
    expect(
      vi
        .mocked(console.error)
        .mock.calls.some((c) => String(c[0]).includes('카탈로그에 없는 prefix')),
    ).toBe(true);
  });

  it('유효한 prefix → 에러 없이 실행', () => {
    // cwd 기반이므로 스탬프 파일이 없어도 0건으로 정상 종료
    prefixMigrate(DEMO_CATALOG, 'permission', 'v1', 'v3', { dryRun: true });
    // 에러 없이 실행되면 성공
  });
});
