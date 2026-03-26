---
def:
  id: verdict-spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: graph-spec
      type: depends_on
---

# VerdictReport + VerdictStore

## 목적 ^purpose

spec/runtime 매칭 결과와 최종 판정 보고서의 canonical 구조.

## 구성 ^overview

- **Verdict 5종**: pass, fail, warn, degraded, unknown — step 단위 및 전체 판정에 사용
- **StepMatch**: 각 spec step의 매칭 노드, verdict, constraint별 상세 결과를 보관
- **MatchResult**: 그래프 매칭 단계의 중간 산출물 — missing_steps, unmatched_nodes 포함
- **VerdictReport**: 최종 보고서 — step_matches가 canonical breakdown이며 별도 passed/failed 배열 없음
- **VerdictStore 포트**: insert, remove, find_by_scenario_and_trace, find_by_trace_id, find_by_session_id 5개 메서드
- **재계산 지원**: 동일 (scenario_id, trace_id) 조합의 기존 결과를 교체 가능
- **필드 규약**: 모든 verdict 관련 필드명은 snake_case, computed_at은 ISO-8601 UTC

## 상태

implemented

## 핵심 enum / supporting types

```typescript
type Verdict = "pass" | "fail" | "warn" | "degraded" | "unknown";

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
  summary: string;
  computed_at: string; // ISO-8601 UTC
}
```

## VerdictStore 포트

```typescript
interface VerdictStore {
  insert(params: VerdictInsert): Promise<void>;
  remove_by_scenario_and_trace(
    scenario_id: string,
    trace_id: string,
  ): Promise<boolean>;
  find_by_scenario_and_trace(
    scenario_id: string,
    trace_id: string,
  ): Promise<StoredVerdict | null>;
  find_by_trace_id(trace_id: string): Promise<StoredVerdict[]>;
  find_by_session_id(qa_session_id: string): Promise<StoredVerdict[]>;
}

interface VerdictInsert {
  id: string;
  scenario_id: string;
  trace_id: string;
  qa_session_id?: string;
  overall_verdict: Verdict;
  report: VerdictReport;
}

interface StoredVerdict extends VerdictInsert {
  computed_at: string; // ISO-8601 UTC
}
```

## 동작

- `step_matches`에는 각 spec step의 최종 판정과 constraint별 상세 결과를 함께 보관한다.
- `summary`는 사람이 빠르게 읽을 수 있는 1줄 요약이다.
- `computed_at`은 `VerdictReport`에 유지되며, 저장소 레코드에서도 조회 가능해야 한다.
- verdict 재계산 시 동일 `(scenario_id, trace_id)` 조합의 기존 결과를 `remove_by_scenario_and_trace()`로 교체할 수 있어야 한다.
- `find_by_trace_id()`는 trace 단위 cleanup, recompute, 디버깅 경로에서 사용한다.

## 제약 조건

- 모든 verdict 관련 필드명은 `snake_case`를 사용한다.
- `StepMatch.constraint_results`는 `ConstraintResult[]`로 고정한다.
- `overall_verdict`는 `step_matches`, `missing_steps`, `latency_violations`를 바탕으로 계산한다.
- `unexpected_nodes`는 spec에 매칭되지 않은 runtime node id 목록이다.
