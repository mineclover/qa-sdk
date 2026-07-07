---
def:
  id: test-phase-propagation
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: review
  layer: mediation
  tags: [structural, testing]
  links:
    - target: scope-nesting-pattern-lifecycle
      type: depends_on
sources:
  - packages/test-types/src/index.ts
  - packages/core/src/types/test-tracking.ts
  - packages/core/src/pipe/test-tracking.ts
  - packages/core/src/pipe/sim-phase-bridge.ts
  - packages/demo-snapshot/src/demo-catalog.ts
---

# test_phase 분류체계 전파

## 목적 ^purpose

`test_phase` 축(11 entries)을 테스트 데이터 모델, 정의 관리, 시뮬레이션에 전파하여 테스트 구성과 관측의 기준을 통일한다.

## 정의 ^defines

- **TestPhase** 타입 — 11종 리터럴 유니온
- **TestCase.phase** — 테스트 케이스에 단계 부여
- **TestSuite.phases** — 스위트가 커버하는 단계 집합
- **PhaseQualityMetrics** — 단계별 품질 지표
- **frontmatter `tests[].phase`** — 스펙 선언에서 단계 지정

## 소비 ^consumes

- `test_phase` axis (`demo-catalog.ts` — 11 entries, capacity 32)
- `TestCase`, `TestSuite`, `TestResult`, `FacetQualityMetrics` (`core/types/test-tracking.ts`)
- `TestRegistry` (`core/pipe/test-tracking.ts`)

## 위임 ^delegates

- Phase 2: CLI 전파 + 시뮬레이션 연계 (별도 spec)

## Phase 1: 데이터 모델 확장

### TestPhase 타입

```typescript
export type TestPhase =
  | "precondition" | "fixture" | "arrange" | "act" | "observe"
  | "assert-primary" | "assert-side" | "assert-negative"
  | "snapshot" | "teardown" | "report";

export const TEST_PHASES: readonly TestPhase[] = [
  "precondition", "fixture", "arrange", "act", "observe",
  "assert-primary", "assert-side", "assert-negative",
  "snapshot", "teardown", "report",
] as const;
```

SSOT: `test-types` 패키지가 정의의 단일 원본. `demo-catalog.ts` test_phase axis와 동기화. core/store/CLI 모두 test-types에서 import.

### TestCase 확장

```typescript
export interface TestCase {
  // 기존 필드 유지
  testId: string;
  address: string;
  name: string;
  target: TestTarget;
  expected: TestExpectation;
  contractRef?: string;
  scope?: string;
  aspect?: string;
  facet?: string;
  tags?: string[];
  // 추가
  phase?: TestPhase;           // 이 테스트가 검증하는 단계
}
```

### TestSuite 확장

```typescript
export interface TestSuite {
  // 기존 필드 유지
  suiteId: string;
  facet: string;
  cases: TestCase[];
  // 추가
  phases?: TestPhase[];        // 이 스위트가 커버하는 단계 집합
}
```

### TestRegistry 확장

```typescript
// 새 메서드
getCasesByPhase(phase: TestPhase): TestCase[];
getSuitesByPhase(phase: TestPhase): TestSuite[];
computePhaseMetrics(phase: TestPhase, schemaUpdatedAt?: string): PhaseQualityMetrics;
```

### PhaseQualityMetrics

```typescript
export interface PhaseQualityMetrics {
  phase: TestPhase;
  totalTests: number;
  passedTests: number;
  passRate: number;
  hasCoverage: boolean;
  lastExecuted?: string;
  hasDrift: boolean;
}
```

FacetQualityMetrics와 대칭 구조. facet × phase 교차 분석 가능.

### 주소 확장

기존: `test:{scope}:{aspect}:{facet}:{seq}`
확장: `test:{scope}:{aspect}:{facet}:{phase}:{seq}`

```typescript
function buildTestAddress(
  scopeIndex: number,
  aspectIndex: number,
  facet: string,
  phase: TestPhase,
  seq: number,
): string;
```

하위 호환: phase 없는 기존 주소는 `parseTestAddress`에서 `phase: undefined`로 파싱.

### Frontmatter 선언

```yaml
tests:
  - name: "라운드트립 검증"
    kind: unit
    scope: single
    phase: assert-primary    # 추가
    intent: "encode → decode 왕복 동치"
```

### PipeQualityMetrics 확장

```typescript
export interface PipeQualityMetrics {
  // 기존 필드 유지
  pipeId: string;
  totalPaths: number;
  testedPaths: number;
  pathCoverage: number;
  facetDistribution: Record<string, number>;
  uncoveredFacets: string[];
  // 추가
  phaseDistribution: Record<string, number>;
  uncoveredPhases: string[];
}
```

## facet × phase 직교 관계

| 차원 | 질문 | 예시 |
|------|------|------|
| facet | **무엇을** 관측하는가 | 소비, 생산, 정의, 관리, 저장 |
| phase | **언제** 검증하는가 | arrange, act, assert-primary |

직교: "소비 패싯의 assert-primary" = "소비 관측에 대한 주 검증 단계"

## 구현 위치

| 파일 | 역할 |
|------|------|
| `packages/test-types/src/index.ts` | TestPhase, TEST_PHASES 정의 SSOT (zero-dep) |
| `packages/core/src/types/test-tracking.ts` | test-types re-export + TestCase.phase, TestSuite.phases, PhaseQualityMetrics |
| `packages/core/src/pipe/test-tracking.ts` | TestRegistry 메서드 + computePipeMetrics 확장 |
| `packages/core/src/pipe/sim-phase-bridge.ts` | SimulationResult → TestPhase 매핑 브릿지 |
| `packages/test-scenario-store/src/types.ts` | test-types re-export (TestPhaseLabel alias) |
| `packages/cli/src/commands/test.ts` | test-types에서 직접 import |
