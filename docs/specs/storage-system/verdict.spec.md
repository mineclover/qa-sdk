---
def:
  tier: component
  id: verdict-spec
  address: def_document:v2:342211
  scope: data
  aspect: domain_data
  depth: specification
  svc: ingest-server
  lifecycle: approved
  layer: domain
  tags: [observability, data, runtime]
  links:
    - target: graph-spec
      type: depends_on
sources:
  - packages/core/src/types/verdict.ts
  - packages/core/src/ports/verdict-store.port.ts
  - packages/store/src/adapters/drizzle/verdict.adapter.ts
  - packages/store/src/adapters/memory/verdict.adapter.ts
  - packages/store/src/adapters/memory/verdict.adapter.test.ts
---

# VerdictReport + VerdictStore

## 목적 ^purpose

spec/runtime 매칭 결과와 최종 판정 보고서의 canonical 구조.

## 구성 ^overview

- **Verdict 6종**: pass, fail, warn, degraded, unknown, skipped — step 단위 및 전체 판정에 사용
- **StepMatch**: 각 spec step의 매칭 노드, verdict, constraint별 상세 결과를 보관
- **MatchResult**: 그래프 매칭 단계의 중간 산출물 — missing_steps, unmatched_nodes 포함
- **VerdictReport**: 최종 보고서 — step_matches가 canonical breakdown이며 별도 passed/failed 배열 없음
- **VerdictStore 포트**: insert, removeByScenarioAndTrace, findByScenarioAndTrace, findByTraceId, findBySessionId 5개 메서드
- **재계산 지원**: 동일 (scenario_id, trace_id) 조합의 기존 결과를 교체 가능
- **필드 규약**: 모든 verdict 관련 필드명은 snake_case, computed_at은 ISO-8601 UTC

## 상태

implemented

## 핵심 enum / supporting types

```typescript
type Verdict = "pass" | "fail" | "warn" | "degraded" | "unknown" | "skipped";

interface ConstraintResult {
  constraint: StepConstraint;
  passed: boolean;
  actual?: unknown;
}

interface StepMatch {
  step_id: string;
  matched_node_id?: string;
  verdict: Verdict;
  constraint_results: ConstraintResult[];
}

interface LatencyViolation {
  step_id: string;
  expected_ms: number;
  actual_ms: number;
}

interface OrderingViolation {
  step_id: string;
  should_follow: string;
  actual_timestamp: string;
  predecessor_timestamp: string;
}
```

## MatchResult 타입

그래프 매칭 단계의 중간 산출물.

```typescript
interface MatchResult {
  scenario_id: string;
  trace_id: string;
  step_matches: StepMatch[];
  missing_steps: string[];
  unmatched_nodes: string[];
  ordering_violations?: OrderingViolation[];
}
```

## VerdictReport 타입

최종 보고서. `step_matches`가 canonical per-step breakdown이며, 별도의 `passed_steps` / `failed_steps` / `warning_steps` 배열은 사용하지 않는다.

```typescript
interface VerdictReport {
  scenario_id: string;
  trace_id: string;
  qa_session_id?: string;
  overall_verdict: Verdict;
  step_matches: StepMatch[];
  missing_steps: string[];
  unexpected_nodes: string[];
  latency_violations: LatencyViolation[];
  ordering_violations: OrderingViolation[];
  summary: string;
  computed_at: string; // ISO-8601 UTC
  path_observation?: PathObservation;
}
```

## VerdictStore 포트

```typescript
interface VerdictStore {
  insert(params: VerdictInsert): Promise<void>;
  removeByScenarioAndTrace(
    scenarioId: string,
    traceId: string,
  ): Promise<boolean>;
  findByScenarioAndTrace(
    scenarioId: string,
    traceId: string,
  ): Promise<StoredVerdict | null>;
  findByTraceId(traceId: string): Promise<StoredVerdict[]>;
  findBySessionId(sessionId: string): Promise<StoredVerdict[]>;
}

interface VerdictInsert {
  id: string;
  scenarioId: string;
  traceId: string;
  qaSessionId?: string;
  overallVerdict: string;
  report: VerdictReport;
}

interface StoredVerdict extends VerdictInsert {
  computedAt: Date;
}
```

## 동작

- `step_matches`에는 각 spec step의 최종 판정과 constraint별 상세 결과를 함께 보관한다.
- `summary`는 사람이 빠르게 읽을 수 있는 1줄 요약이다.
- `computed_at`은 `VerdictReport`에 유지되며, 저장소 레코드에서도 조회 가능해야 한다.
- verdict 재계산 시 동일 `(scenario_id, trace_id)` 조합의 기존 결과를 `removeByScenarioAndTrace()`로 교체할 수 있어야 한다.
- `findByTraceId()`는 trace 단위 cleanup, recompute, 디버깅 경로에서 사용한다.

## 제약 조건

- 모든 verdict 관련 필드명은 `snake_case`를 사용한다.
- `StepMatch.constraint_results`는 `ConstraintResult[]`로 고정한다.
- `overall_verdict`는 `step_matches`, `missing_steps`, `latency_violations`를 바탕으로 계산한다.
- `unexpected_nodes`는 spec에 매칭되지 않은 runtime node id 목록이다.
