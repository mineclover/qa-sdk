# Track F — 분석 결정론·Provenance 기반 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 같은 입력이면 convergence·DKG 분석이 같은 출력을 내고, 모든 자동 observation이 어떤 producer·버전·입력에서 나왔는지 기록되게 한다. G3(incremental convergence)의 cache key와 full/incremental differential test가 이 성질에 의존한다.

**Architecture:** 숨은 `new Date()` 호출을 `Clock` 주입으로 바꾼다(기본값은 현재 동작과 동일 → 하위 호환). `ObservationNode`에 optional `provenance`를 추가한다(정본 `dkg/src/dkg.types.ts`, 사본 `convergence/src/dkg-types.ts`). 두 패키지를 모두 의존하는 `dkg-enrichment`에 타입 drift 테스트를 둬 사본이 다시 어긋나지 않게 한다. 중복 구현(`scaffoldDecision` 등)은 소유 패키지를 정하는 판정만 하고, 이동은 G3에서 한다.

**Tech Stack:** TypeScript, vitest(`expectTypeOf`, fake timers)

**Spec:** [README](../README.md) §2 Wave 2 G3·G5 전제 / [00-code-inventory.md](../00-code-inventory.md) §3, X-14·X-15·X-17 / Drive 원본 Phase 3 "producer version", Phase 5 "analyzer version 기록"

## Global Constraints

- 공개 API는 하위 호환: 새 인자는 optional, 기본 동작은 현재와 동일
- 의존 방향: `convergence`는 `dkg`를 import하지 않는다(현재 deps: core, spec-schema, weighted-index). `dkg-enrichment`는 둘 다 의존한다
- 라이브러리 로깅은 `createLogger` 또는 생성자 주입, `console.*` 금지
- ISO-8601 비교는 `compareTimestamps(a, b)` (`@qa-sdk/core`) — 문자열 비교 금지
- observation ID 체계(`OBS-METRIC-*`, `OBS-PATTERN-*`)는 바꾸지 않는다 (upsert 의미 유지)
- `packages/ingest-server/**`는 수정하지 않는다 (Track E). clock 주입 호출부 연결은 E가 F 머지 후 수행

## Review Focus

1. **자정 경계에서 실행** → 같은 실행 안의 모든 단계가 같은 날짜를 쓴다(clock 1회 평가 후 전달). 테스트: Task 1 Step 1.
2. **clock 미지정 호출(기존 호출부)** → 기존과 같은 결과 형태. 테스트: Task 1 Step 1.
3. **provenance 없는 기존 저장 observation 로드** → 오류 없이 `provenance: undefined`. 테스트: Task 2 Step 1.
4. **사본 타입에 필드가 빠지는 drift** → 컴파일 실패. 테스트: Task 3 Step 1.
5. **같은 입력 2회 실행** → `toEqual` 동일(정렬 순서 포함). 테스트: Task 1 Step 1.

---

## File Structure

| 경로 | 책임 |
|---|---|
| `packages/convergence/src/clock.ts` (신규) | `Clock` 타입, `systemClock`, `isoDate(clock)` |
| `packages/convergence/src/{metric-registry,convergence-runner,causal-discovery,headroom-advisor,pattern-aggregator,pattern-anomaly,pattern-classifier,self-check-analyzer}.ts` | `clock` 옵션 |
| `packages/convergence/src/determinism.test.ts` (신규) | 같은 입력·clock → 같은 출력 |
| `packages/dkg/src/dkg.types.ts` | `ObservationProvenance`, `ObservationNode.provenance?` |
| `packages/convergence/src/dkg-types.ts` | 사본 동기화 (`metadata`, `provenance`) |
| `packages/convergence/src/producer-info.ts` (신규) | `CONVERGENCE_PRODUCER`, version |
| `packages/dkg/src/store/dkg-sqlite-store.ts` | provenance 직렬화 round-trip 확인 |
| `packages/dkg-enrichment/src/type-drift.test.ts` (신규) | 사본 ↔ 정본 타입 동치 |

**Interfaces — Produces (G3·G5 소비):**

```ts
// convergence/src/clock.ts
export type Clock = () => Date;
export const systemClock: Clock;
export function isoDate(clock: Clock): string;      // 'YYYY-MM-DD' (UTC)
export function isoInstant(clock: Clock): string;   // toISOString()

// dkg/src/dkg.types.ts (convergence 사본도 동일)
export interface ObservationProvenance {
  readonly producer: string;            // 'convergence/metric-registry'
  readonly producerVersion: string;     // package version
  readonly algorithmVersion?: string;   // 규칙·알고리즘 버전 (G3 cache key 구성요소)
  readonly inputDigest?: string;        // T0 digestCanonical(input) — G3에서 채움
  readonly catalogDigest?: string;
}
// ObservationNode.provenance?: ObservationProvenance
```

---

### Task 0: Baseline·clock 지점 재확인

- [ ] **Step 1:** `cd /Users/junwoobang/workflow/qa-sdk && for p in @qa-sdk/convergence dkg dkg-enrichment; do echo "== $p"; corepack pnpm --filter $p test 2>&1 | grep -E "Tests|FAIL" | tail -2; done` → PASS
- [ ] **Step 2:** `grep -rn "new Date()" packages/convergence/src --include='*.ts' | grep -v '\.test\.ts'` — 현재 8개 파일(metric-registry 3곳, convergence-runner, causal-discovery, headroom-advisor, pattern-aggregator, pattern-anomaly, pattern-classifier, self-check-analyzer). 결과를 Task 1 대상 목록으로 쓴다.

---

### Task 1: Clock 주입

- [ ] **Step 1: 실패하는 테스트 (`determinism.test.ts`)**

```ts
import { DEMO_CATALOG } from 'demo-snapshot';
import { describe, expect, it } from 'vitest';
import { isoDate, type Clock } from './clock.js';
import { collectMetrics, metricsToObservations } from './metric-registry.js';
import { buildDeterminismFixture } from './__fixtures__/determinism-fixture.js';

const fixed = (iso: string): Clock => () => new Date(iso);

describe('convergence 결정론', () => {
  it('같은 입력과 clock이면 같은 metric·observation', () => {
    const input = buildDeterminismFixture(DEMO_CATALOG);
    const clock = fixed('2026-10-28T23:59:59.999Z');
    const a = metricsToObservations(collectMetrics(input.graph, input.usage, { clock }), { clock });
    const b = metricsToObservations(collectMetrics(input.graph, input.usage, { clock }), { clock });
    expect(b).toEqual(a);
  });

  it('clock이 날짜를 결정한다 (자정 경계)', () => {
    const input = buildDeterminismFixture(DEMO_CATALOG);
    const obs = metricsToObservations(collectMetrics(input.graph, input.usage, { clock: fixed('2026-10-28T23:59:59.999Z') }), {
      clock: fixed('2026-10-28T23:59:59.999Z'),
    });
    expect(obs.every((o) => JSON.stringify(o).includes('2026-10-28'))).toBe(true);
  });

  it('clock 미지정 시 기존 동작 (오늘 날짜)', () => {
    const input = buildDeterminismFixture(DEMO_CATALOG);
    const obs = metricsToObservations(collectMetrics(input.graph, input.usage));
    expect(JSON.stringify(obs)).toContain(isoDate(() => new Date()));
  });
});
```

`buildDeterminismFixture`는 기존 `metric-registry` 테스트가 쓰는 graph·usage 입력 구성을 그대로 옮긴 함수다(`grep -n "collectMetrics(" packages/convergence/src/*.test.ts`로 찾는다). `collectMetrics`·`metricsToObservations`의 실제 인자 위치가 다르면 기존 options 객체에 `clock`을 넣는 형태로 맞춘다.

- [ ] **Step 2: 구현**

```ts
// packages/convergence/src/clock.ts
/** 분석 시각 공급자 — 결정론 테스트와 G3 재계산에서 주입한다 */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export function isoInstant(clock: Clock): string {
  return clock().toISOString();
}

export function isoDate(clock: Clock): string {
  return isoInstant(clock).slice(0, 10);
}
```

Task 0 Step 2 목록의 각 함수 options에 `clock?: Clock`를 추가하고 `new Date()`를 `isoInstant(options?.clock ?? systemClock)` / `isoDate(...)`로 바꾼다. 기존 `options.date`가 있는 함수는 `options.date ?? isoDate(options.clock ?? systemClock)` 순서를 유지한다. 한 진입점(`runConvergenceAnalysis`, `collectMetrics`) 안에서는 clock을 한 번 평가한 값을 하위 호출에 넘겨 같은 실행이 서로 다른 날짜를 갖지 않게 한다. `index.ts`에 `Clock`, `systemClock` export.

- [ ] **Step 3:** `corepack pnpm --filter @qa-sdk/convergence build && corepack pnpm --filter @qa-sdk/convergence test && corepack pnpm --filter dkg-enrichment test` → PASS
- [ ] **Step 4: Commit** — `refactor(convergence): Clock 주입으로 분석 결정론 확보`

---

### Task 2: Observation provenance

- [ ] **Step 1: 실패하는 테스트**
  - `convergence`: `metricsToObservations` 결과의 모든 observation에 `provenance.producer === 'convergence/metric-registry'`, `producerVersion === CONVERGENCE_PRODUCER_VERSION`.
  - `dkg`: provenance가 있는 observation을 `DkgSqliteStore`(`NodeSqliteDriver(':memory:')` + DDL)에 `saveNodes` 후 `loadGraph`하면 provenance가 보존되고, provenance가 없는 기존 형태 노드도 로드된다.
- [ ] **Step 2: 구현** — `dkg.types.ts`에 Interfaces 블록의 `ObservationProvenance`와 `provenance?` 추가. `convergence/src/dkg-types.ts` 사본에 같은 필드와 빠져 있던 `metadata`를 추가. `producer-info.ts`에 `CONVERGENCE_PRODUCER_VERSION`(package.json과 일치함을 테스트로 고정 — Track D `generator-info` 패턴). 자동 observation 생성 지점(00-code-inventory §3: `metricsToObservations`, pattern classification, `discoverCausalityWithObservations`)에서 provenance를 채운다. `algorithmVersion`은 metric은 `METRIC_DEFS`의 canonical digest가 아닌 명시 상수 `'metric-registry/1'`로 시작한다(G3에서 digest로 승격).
- [ ] **Step 3:** store가 `data` JSON 컬럼에 노드 전체를 저장하므로 스키마 변경은 없어야 한다. round-trip 테스트로 확인만 한다.
- [ ] **Step 4: Commit** — `feat(dkg): observation provenance 필드와 convergence producer 기록`

---

### Task 3: 사본 타입 drift 테스트

**Files:** `packages/dkg-enrichment/src/type-drift.test.ts` (신규)

- [ ] **Step 1: 테스트 작성**

```ts
import type { ObservationNode as ConvergenceObservation } from '@qa-sdk/convergence';
import type { ObservationNode as DkgObservation } from 'dkg';
import { describe, expectTypeOf, it } from 'vitest';

describe('convergence DKG 타입 사본 drift', () => {
  it('ObservationNode가 정본과 상호 할당 가능하다', () => {
    expectTypeOf<ConvergenceObservation>().toMatchTypeOf<DkgObservation>();
    expectTypeOf<DkgObservation>().toMatchTypeOf<ConvergenceObservation>();
  });
});
```

`convergence`가 `ObservationNode`를 export하지 않으면 `dkg-types.ts`의 타입을 `index.ts`에서 `export type`으로 노출한다. `DecisionNode`, `ConstraintNode`도 같은 형태로 추가한다(00-code-inventory X-14).

- [ ] **Step 2:** `corepack pnpm --filter dkg-enrichment exec vitest typecheck` 또는 vitest의 typecheck 설정이 없으면 `tsc --noEmit`이 test 파일을 포함하는지 확인하고, 포함하지 않으면 `vitest run --typecheck`로 실행한다. 현재 사본(Task 2 이전)에서는 FAIL, Task 2 이후 PASS여야 한다.
- [ ] **Step 3: Commit** — `test(dkg-enrichment): convergence DKG 타입 사본 drift 검사`

---

### Task 4: 중복 구현 소유 판정 (X-15, X-17)

- [ ] **Step 1:** `scaffoldDecision`(`dkg/src/decision-scaffold.ts`, `convergence/src/decision-scaffold.ts`)과 dkg ↔ dkg-enrichment `skills/{converge-chain,coverage-audit,flow-trace}.ts`의 diff를 뜨고, 프로덕션 호출 경로(ingest-server는 dkg `traceFlows`를 spec-core/dkg 경유로 사용)를 기준으로 정본 패키지를 제안한다.
- [ ] **Step 2:** 결과를 00-code-inventory X-15·X-17에 기록하고, 이동·삭제는 G3 계획의 Task로 넘긴다. 이 Task에서는 코드를 옮기지 않는다.
- [ ] **Step 3: Commit** — `docs: 분석 계층 중복 구현 소유 판정 기록`
