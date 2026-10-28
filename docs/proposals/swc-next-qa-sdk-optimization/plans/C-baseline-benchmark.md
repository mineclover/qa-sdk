# Track C — Baseline Benchmark·결과 포맷·CI Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 코드를 바꾸기 전에 codec·envelope hot path의 현재 성능을 재현 가능한 JSON으로 기록하고, 같은 측정을 CI에서 반복할 수 있게 한다.

**Architecture:** 기존 `packages/bench`(시나리오·transport 하네스)에 **microbench 계층**을 추가한다. 측정 대상은 이미 존재하는 공개 함수만 쓴다(최적화 코드 없음). 결과는 측정 조건(commit, runtime, catalog digest, warm/cold)을 함께 담은 `BenchmarkReportV1` JSON이다. CI job은 일반 test job과 분리하고, PR에서는 smoke만, 전체 측정은 nightly·수동이다(D-7).

**Tech Stack:** TypeScript, `node:perf_hooks`, `process.hrtime.bigint`, `--expose-gc`, GitHub Actions

**Spec:** [README](../README.md) R-9, D-7 / Drive 원본 Phase 0 "baseline benchmark", §8.3 성능 테스트

## Global Constraints

- T0 없이 착수 가능. `catalogDigest`는 T0 머지 전 `null`, 머지 후 `computeCatalogDigest(DEMO_CATALOG)`
- 측정 대상 코드를 수정하지 않는다 (baseline은 "변경 전"이어야 한다)
- prefix 표본은 DEMO_CATALOG에서 파생. 개수 하드코딩 금지
- CLI는 `console.log` 허용
- 결과 파일은 git에 커밋하지 않는다(`benchmarks/results/`를 `.gitignore`). baseline 1건만 `benchmarks/baseline/`에 커밋한다
- 숫자 비교 기준(회귀 임계값)은 이 트랙에서 정하지 않는다. G2 착수 판정에서 baseline 분산을 보고 정한다

## Review Focus

1. **`--expose-gc` 없이 실행** → allocation 지표를 `null`로 기록하고 경고. 0이나 추정값을 쓰지 않는다. 테스트: Task 2 Step 1.
2. **iterations가 너무 작아 percentile이 무의미** → `iterations < 100`이면 p99를 `null`. 테스트: Task 1 Step 1.
3. **JIT warmup 미적용 측정** → `warm: false` 실행을 별도 case로 기록, 섞지 않음. 테스트: Task 2 Step 1.
4. **CI runner 하드웨어 차이** → report에 cpu model·cpus 기록, 비교 시 다른 하드웨어끼리 비교 경고. 테스트: Task 1 Step 1 (필드 존재).
5. **측정 중 예외 (예: R-11 prefix encode 실패)** → case를 `skipped`로 기록하고 이유 보존, 전체 실행 중단 안 함. 테스트: Task 2 Step 1.

---

## File Structure

| 경로 | 책임 |
|---|---|
| `packages/bench/src/micro/report-schema.ts` (신규, +test) | `BenchmarkReportV1` 타입, 생성·검증 |
| `packages/bench/src/micro/measure.ts` (신규, +test) | 단일 case 측정 (warmup, hrtime, gc) |
| `packages/bench/src/micro/codec-suite.ts` (신규, +test) | codec·envelope case 정의 |
| `packages/bench/src/micro/cli.ts` (신규) | `qa-bench-micro` 진입점 |
| `packages/bench/package.json` | bin `qa-bench-micro`, dependency `@qa-sdk/browser-codec` |
| `benchmarks/README.md` | 실행법, retention, 비교 규칙 |
| `benchmarks/baseline/` (신규) | 최초 baseline 1건 |
| `.gitignore` | `benchmarks/results/` |
| `.github/workflows/bench.yml` (신규) | smoke(PR) / full(nightly·dispatch) |

**Interfaces — Produces (G2 착수 판정이 소비):**

```ts
export interface BenchmarkEnvironment {
  readonly commitSha: string | null;
  readonly node: string;
  readonly platform: string;
  readonly arch: string;
  readonly cpuModel: string;
  readonly cpus: number;
  readonly gcExposed: boolean;
}
export interface MicroCaseResult {
  readonly id: string;               // 'core.encodePrefix/service@v1'
  readonly status: 'ok' | 'skipped';
  readonly skipReason?: string;
  readonly warm: boolean;
  readonly iterations: number;
  readonly nsPerOp: { readonly mean: number; readonly p50: number; readonly p95: number; readonly p99: number | null } | null;
  readonly opsPerSec: number | null;
  readonly heapDeltaBytesPerOp: number | null; // gcExposed=false면 null
}
export interface BenchmarkReportV1 {
  readonly schemaVersion: 1;
  readonly suite: string;
  readonly createdAt: string;        // 비교용 메타데이터 (결과 동일성 판정에는 쓰지 않음)
  readonly catalogId: string;
  readonly catalogDigest: string | null;
  readonly environment: BenchmarkEnvironment;
  readonly cases: readonly MicroCaseResult[];
}
export function measureCase(options: { id: string; warm: boolean; iterations: number; run: () => unknown }): MicroCaseResult;
export function createCodecSuite(catalog: Catalog): readonly { id: string; run: () => unknown }[];
```

---

### Task 0: Baseline

- [ ] **Step 1:** `cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/bench build && corepack pnpm --filter @qa-sdk/bench test 2>&1 | tail -3` → PASS
- [ ] **Step 2:** `benchmarks/README.md`의 기존 결과 표를 읽고 이번 microbench와 겹치는 항목(JSON vs QAPB transport)을 기록한다. 겹치면 microbench에서 제외하고 README에서 기존 스크립트를 가리킨다.

---

### Task 1: 결과 포맷

**Files:** `packages/bench/src/micro/report-schema.ts`, `report-schema.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from 'vitest';
import { collectEnvironment, summarizeNs, validateReport } from './report-schema.js';

describe('report-schema', () => {
  it('percentile을 계산하고 표본이 100 미만이면 p99는 null', () => {
    const small = summarizeNs(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(small.p50).toBe(25);
    expect(small.p99).toBeNull();
    const large = summarizeNs(Array.from({ length: 1000 }, (_, i) => i + 1));
    expect(large.p99).toBe(990);
  });

  it('환경 정보에 하드웨어 필드를 포함한다', () => {
    const env = collectEnvironment();
    expect(env).toMatchObject({ node: process.version, platform: process.platform, arch: process.arch });
    expect(env.cpus).toBeGreaterThan(0);
    expect(typeof env.cpuModel).toBe('string');
  });

  it('schemaVersion이 다르면 검증 실패', () => {
    expect(() => validateReport({ schemaVersion: 2 })).toThrow();
  });
});
```

- [ ] **Step 2: 구현** — `summarizeNs(samples: number[])`: 오름차순 정렬 후 nearest-rank percentile(`Math.ceil(p/100 * n) - 1` 인덱스), `n < 100`이면 p99 `null`. `collectEnvironment()`: `os.cpus()[0]?.model ?? 'unknown'`, `commitSha`는 `process.env.GITHUB_SHA ?? null`(CLI에서 `git rev-parse HEAD`로 보강), `gcExposed: typeof globalThis.gc === 'function'`. `validateReport(value: unknown): BenchmarkReportV1` — 필드 존재·타입 수동 검사(신규 의존성 추가 금지).
- [ ] **Step 3:** 테스트 PASS → Commit `feat(bench): microbench 결과 포맷 BenchmarkReportV1`

---

### Task 2: 측정기와 codec suite

**Files:** `packages/bench/src/micro/measure.ts`, `codec-suite.ts` (+tests), `packages/bench/package.json`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { DEMO_CATALOG } from 'demo-snapshot';
import { describe, expect, it } from 'vitest';
import { createCodecSuite } from './codec-suite.js';
import { measureCase } from './measure.js';

describe('measureCase', () => {
  it('정상 case는 ok와 nsPerOp를 기록한다', () => {
    const r = measureCase({ id: 'noop', warm: true, iterations: 200, run: () => 1 + 1 });
    expect(r.status).toBe('ok');
    expect(r.nsPerOp?.p50).toBeGreaterThanOrEqual(0);
    expect(r.iterations).toBe(200);
  });

  it('gc가 노출되지 않으면 heapDeltaBytesPerOp는 null', () => {
    const r = measureCase({ id: 'noop', warm: true, iterations: 200, run: () => ({}) });
    if (typeof globalThis.gc !== 'function') expect(r.heapDeltaBytesPerOp).toBeNull();
  });

  it('예외가 나면 skipped로 기록하고 이유를 보존한다', () => {
    const r = measureCase({ id: 'boom', warm: true, iterations: 10, run: () => { throw new Error('Unknown axis version'); } });
    expect(r).toMatchObject({ status: 'skipped', skipReason: expect.stringContaining('Unknown axis version'), nsPerOp: null });
  });

  it('cold 측정은 warm=false로 따로 기록한다', () => {
    expect(measureCase({ id: 'x', warm: false, iterations: 1, run: () => 0 }).warm).toBe(false);
  });
});

describe('createCodecSuite', () => {
  it('catalog의 모든 prefix에 대해 encode·decode case를 만든다', () => {
    const suite = createCodecSuite(DEMO_CATALOG);
    const prefixCount = Object.keys(DEMO_CATALOG.prefixes).length;
    expect(suite.filter((c) => c.id.startsWith('core.encodePrefix/'))).toHaveLength(prefixCount);
    expect(suite.filter((c) => c.id.startsWith('core.decodePrefix/'))).toHaveLength(prefixCount);
    expect(suite.some((c) => c.id.startsWith('envelope.json/'))).toBe(true);
  });
});
```

- [ ] **Step 2: 구현**

`measure.ts`:

```ts
import { performance } from 'node:perf_hooks';
import { summarizeNs } from './report-schema.js';
import type { MicroCaseResult } from './report-schema.js';

const WARMUP_ITERATIONS = 1_000;

export function measureCase(options: {
  id: string;
  warm: boolean;
  iterations: number;
  run: () => unknown;
}): MicroCaseResult {
  const { id, warm, iterations, run } = options;
  try {
    if (warm) for (let i = 0; i < WARMUP_ITERATIONS; i++) run();
    const gc = (globalThis as { gc?: () => void }).gc;
    gc?.();
    const heapBefore = process.memoryUsage().heapUsed;
    const samples = new Array<number>(iterations);
    const started = performance.now();
    for (let i = 0; i < iterations; i++) {
      const t0 = process.hrtime.bigint();
      run();
      samples[i] = Number(process.hrtime.bigint() - t0);
    }
    const elapsedMs = performance.now() - started;
    const heapDelta = gc ? (process.memoryUsage().heapUsed - heapBefore) / iterations : null;
    return {
      id,
      status: 'ok',
      warm,
      iterations,
      nsPerOp: summarizeNs(samples),
      opsPerSec: elapsedMs > 0 ? (iterations / elapsedMs) * 1_000 : null,
      heapDeltaBytesPerOp: heapDelta,
    };
  } catch (error) {
    return {
      id,
      status: 'skipped',
      skipReason: error instanceof Error ? error.message : String(error),
      warm,
      iterations,
      nsPerOp: null,
      opsPerSec: null,
      heapDeltaBytesPerOp: null,
    };
  }
}
```

`heapDeltaBytesPerOp`는 GC 타이밍 영향을 받는 근사치다. README에 "allocation 상한 추정, 정확한 allocation profile은 G2에서 `--heap-prof`로 별도 측정"이라고 적는다.

`codec-suite.ts` — prefix별 case 2개(`core.encodePrefix/<id>@<latest>`, `core.decodePrefix/<id>@<latest>`): positions는 모든 dim position 0, 주소는 suite 생성 시 1회 encode한 값(실패하면 run이 throw하도록 두어 `skipped`로 기록). 추가 case: `core.parseSerializedAddress`, `browser-codec.encode/<id>`, `browser-codec.decode/<id>`(대표 prefix 1개 — `service`가 있으면 그것, 없으면 첫 prefix), `envelope.json/<n>`(`n ∈ {1, 50, 500}` records의 `JSON.stringify` + `JSON.parse` — 50/500은 logger 기본 batch/buffer 값을 `@qa-sdk/logger`의 `DEFAULT_BATCH_SIZE`, `DEFAULT_MAX_BUFFER_SIZE` import로 파생). version은 `latestPrefixVersion`으로 조회.

`package.json`: dependencies에 `"@qa-sdk/browser-codec": "workspace:*"`, `"@qa-sdk/logger"`(실제 이름 확인) 추가.

- [ ] **Step 3:** 테스트 PASS → Commit `feat(bench): codec·envelope microbench suite`

---

### Task 3: CLI와 baseline 기록

**Files:** `packages/bench/src/micro/cli.ts`, `packages/bench/package.json` (bin), `benchmarks/README.md`, `.gitignore`, `benchmarks/baseline/`

- [ ] **Step 1:** CLI 구현 — `parseArgs`로 `--iterations`(기본 10000), `--cold`(warm=false case 추가), `--filter <substring>`, `--out <path>`. 결과를 `validateReport`로 검증한 뒤 쓰고, 표준출력에 상위 10개 느린 case 표를 출력한다. `catalogDigest`: `@qa-sdk/core`가 `computeCatalogDigest`를 export하면 사용, 아니면 `null` (T0 머지 여부를 동적 확인하지 말고, T0 머지 후 이 줄을 바꾸는 후속 커밋으로 처리).
- [ ] **Step 2:** `package.json` bin에 `"qa-bench-micro": "./dist/micro/cli.js"`.
- [ ] **Step 3: baseline 기록**

```bash
cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/bench build && mkdir -p benchmarks/baseline && node --expose-gc packages/bench/dist/micro/cli.js --cold --out "benchmarks/baseline/codec-$(git rev-parse --short HEAD).json"
```

Expected: 파일 생성, `skipped` case에 R-11 prefix(`build_event` 등은 latest가 v2라 통과할 수 있음 — 실제 skipped 목록을 README에 기록).

- [ ] **Step 4:** `.gitignore`에 `benchmarks/results/` 추가. `benchmarks/README.md`에 실행법, `--expose-gc` 필요성, retention(결과 artifact 30일, baseline은 G2 착수 판정 때 1회 갱신), "같은 cpuModel끼리만 수치 비교" 규칙을 적는다.
- [ ] **Step 5: Commit** — `feat(bench): qa-bench-micro CLI와 codec baseline 기록`

---

### Task 4: CI workflow

**Files:** `.github/workflows/bench.yml` (신규)

- [ ] **Step 1: workflow 작성**

```yaml
name: benchmark

on:
  pull_request:
    paths:
      - 'packages/bench/**'
      - 'packages/core/src/catalog/**'
      - 'packages/browser-codec/src/**'
      - '.github/workflows/bench.yml'
  schedule:
    - cron: '0 18 * * *'
  workflow_dispatch:
    inputs:
      iterations:
        description: 'case당 측정 반복 수'
        default: '10000'

concurrency:
  group: benchmark-${{ github.ref }}
  cancel-in-progress: true

jobs:
  bench:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: false
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Enable Corepack
        run: |
          corepack enable
          corepack prepare pnpm@11.28.6 --activate
      - name: Install dependencies
        run: pnpm install --filter '@qa-sdk/bench...' --frozen-lockfile
      - name: Build
        run: pnpm --workspace-concurrency=1 --filter '@qa-sdk/bench...' run build
      - name: Run microbench
        run: |
          mkdir -p benchmarks/results
          ITER="${{ github.event_name == 'pull_request' && '500' || inputs.iterations || '10000' }}"
          node --expose-gc packages/bench/dist/micro/cli.js --iterations "$ITER" --cold --out "benchmarks/results/codec-${GITHUB_SHA::7}.json"
      - uses: actions/upload-artifact@v4
        with:
          name: bench-${{ github.sha }}
          path: benchmarks/results/
          retention-days: 30
```

PR 실행은 smoke(500 iterations)이며 수치로 실패하지 않는다. 실패 조건은 실행 오류와 report 검증 실패뿐이다.

- [ ] **Step 2:** `def-verification.yml`과 같은 pnpm 버전·install filter 패턴인지 확인하고, YAML에 `--filter "!pkg"` negation을 쓰지 않는다(memory: GitHub Actions에서 비신뢰).
- [ ] **Step 3: Commit** — `ci: codec microbench workflow 추가 (PR smoke, nightly full)`
