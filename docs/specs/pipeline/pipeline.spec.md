# Engine Pipeline

> EventRecord[] → VerdictReport. 순수 연산 파이프라인 4단계.

## 상태

implemented (순수 함수), reconstruction + verdict orchestration implemented

## 전체 흐름

```
EventRecord[]
  → reconstruct()     → RuntimeGraph
ScenarioSpec
  → compileSpec()     → SpecGraph
(SpecGraph, RuntimeGraph)
  → matchGraphs()     → MatchResult
MatchResult
  → computeVerdict()  → VerdictReport
```

모든 함수는 순수 (DB/HTTP 의존 없음, 동일 입력 → 동일 출력).

추가로 두 개의 orchestration helper가 있다:

- `reconstructPendingTraces()`: `TraceStore.findUnreconstructed()` 배치를 순회하며
  `RecordStore.findByTraceId()` → `reconstruct()` → `GraphStore.upsert()` →
  `TraceStore.markReconstructed()` 흐름을 실행.

- `computePendingVerdicts(traceIds)`: 재구성된 trace 목록에 대해
  trace → session → scenarioId 조회 → `ScenarioSpecStore.findById()` →
  `compileSpec()` → `matchGraphs()` → `computeVerdict()` → `VerdictStore.insert()` 흐름을 실행.
  이미 verdict가 존재하는 (scenarioId, traceId) 조합은 건너뜀.

---

## 1. Reconstruction

```typescript
function reconstruct(records: EventRecord[], options?: ReconstructionOptions): RuntimeGraph;

interface ReconstructionOptions {
  includeTemporalEdges?: boolean;  // default: true
}
```

내부 파이프라인:
- `groupByTrace()` — trace_id별 그룹핑
- `sortByTimestamp()` — 시간순 정렬
- `buildSpanTree()` — parent-child span 트리 구성 → parent_child edges
- `buildTemporalEdges()` — 시간순 이벤트 간 temporal edge 생성

제약: parent_span_id 누락 시 root node로 처리.

---

## 2. Spec Compiler

```typescript
function compileSpec(spec: ScenarioSpec): SpecGraph;
```

- ScenarioSpec의 steps → SpecNode[]
- step 간 순서/분기 → SpecEdge[] (sequence, branch, optional)
- constraints는 SpecNode에 포함

제약: 순환 참조, 없는 stepId 참조 시 에러.

---

## 3. Matching

```typescript
function matchGraphs(spec: SpecGraph, runtime: RuntimeGraph): MatchResult;
function evaluateConstraint(constraint: StepConstraint, node: RuntimeNode): boolean;
function evaluateConstraints(constraints: StepConstraint[], node: RuntimeNode): { constraint: StepConstraint; passed: boolean; actual?: unknown }[];
```

- SpecGraph의 각 노드를 RuntimeGraph에서 매칭 (event_key 기준)
- 매칭된 노드에 대해 constraint 평가
- 매칭되지 않은 spec step, runtime node 추적

제약: greedy 매칭 (최적 매칭이 아닌 순차 매칭).

---

## 4. Verdict

```typescript
function computeVerdict(matchResult: MatchResult): VerdictReport;
```

verdict 등급 결정:
- 모든 step pass → **pass**
- constraint 위반 없지만 unmatched step → **warn**
- latency 위반만 → **degraded**
- constraint 위반 → **fail**
- 판정 불가 → **unknown**

제약: worst-case 기준 (가장 나쁜 결과로 overall 결정).
