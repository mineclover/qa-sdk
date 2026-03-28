---
def:
  id: pipeline-spec-original
  address: def_document:v1:1073
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: deprecated
  svc: ingest-server
---

# Engine Pipeline

## 목적 ^purpose

`EventRecord[]`를 `RuntimeGraph`로 재구성하고, `SpecGraph` 매칭 결과를 `VerdictReport`로 계산하는 canonical pipeline spec.

## 상태

implemented

## 설계 원칙

- 이 문서는 refactor target 기준의 canonical function signature를 정의한다.
- 파라미터/필드 명명은 `snake_case`를 사용한다.
- pure pipeline 함수와 I/O orchestration helper를 구분한다.

## 전체 흐름

```typescript
EventRecord[]
  → reconstruct(trace_id, records, options) → RuntimeGraph
ScenarioSpec
  → compileSpec(spec) → SpecGraph
(SpecGraph, RuntimeGraph)
  → matchGraphs(spec_graph, runtime_graph) → MatchResult
(MatchResult, SpecGraph, RuntimeGraph)
  → computeVerdict(match_result, spec_graph, runtime_graph, qa_session_id?) → VerdictReport
```

- `reconstruct()`, `compileSpec()`, `matchGraphs()`, `computeVerdict()`는 pure function으로 유지한다.
- batch 처리와 저장소 접근은 orchestration layer에서 담당한다.

## 1. Reconstruction

```typescript
interface ReconstructionOptions {
  temporal_strategy?: "span-local" | "global";
}

function reconstruct(
  trace_id: string,
  records: EventRecord[],
  options?: ReconstructionOptions,
): RuntimeGraph;
```

- `trace_id`는 결과 `RuntimeGraph.trace_id`에 그대로 반영되는 명시적 입력이다.
- `temporal_strategy`의 기본값은 `"span-local"`이다.
- `"span-local"`은 같은 span 안에서만 temporal edge를 생성한다.
- `"global"`은 span 연결 정보가 불완전한 경우 trace 전체 시간순으로 temporal edge를 생성하는 fallback 전략이다.

내부 파이프라인:
- `sortByTimestamp()` — 시간순 정렬
- `buildSpanTree()` — parent-child span 구조를 edge로 구성
- `buildTemporalEdges()` / global temporal edge builder — temporal 전략에 따라 순서 edge 생성
- 중복 edge 제거 후 `RuntimeGraph` 반환

## 2. Spec Compiler

```typescript
function compileSpec(spec: ScenarioSpec): SpecGraph;
```

- `ScenarioSpec`의 steps와 navigation을 verdict 계산에 필요한 `SpecGraph`로 투영한다.
- steps → `SpecNode[]`, next/branches → `SpecEdge[]`로 변환하는 순수 구조 변환이다.
- step 참조 유효성 검사나 순환 참조 탐지는 이 함수의 책임이 아니다. 그래프 구조 이상은 verdict 계산 결과(unmatched/missing)로 드러난다.

## 3. Matching

```typescript
interface ConstraintResult {
  constraint: StepConstraint;
  passed: boolean;
  actual?: unknown;
}

function matchGraphs(
  spec_graph: SpecGraph,
  runtime_graph: RuntimeGraph,
): MatchResult;

function evaluateConstraint(
  constraint: StepConstraint,
  node: RuntimeNode,
): boolean;

function evaluateConstraints(
  constraints: StepConstraint[],
  node: RuntimeNode,
): ConstraintResult[];
```

- `matchGraphs()`는 spec step별로 runtime node를 찾아 `MatchResult`를 만든다.
- `evaluateConstraints()`는 constraint별 pass/fail과 필요 시 `actual` 값을 남기는 `ConstraintResult[]`를 반환한다.
- `MatchResult.step_matches[*].constraint_results`는 `evaluateConstraints()`의 결과를 보관하는 canonical 위치다.
- 매칭되지 않은 required step은 `missing_steps`, 남는 runtime node는 `unmatched_nodes`로 추적한다.

## 4. Verdict

```typescript
function computeVerdict(
  match_result: MatchResult,
  spec_graph: SpecGraph,
  runtime_graph: RuntimeGraph,
  qa_session_id?: string,
): VerdictReport;
```

- `computeVerdict()`는 `match_result`, `spec_graph`, `runtime_graph`를 함께 사용해 step-level verdict와 latency 위반을 계산한다.
- `qa_session_id`가 주어지면 결과 `VerdictReport.qa_session_id`에 포함한다.
- `overall_verdict`는 `step_matches`, `missing_steps`, `latency_violations`를 기준으로 계산한다.
- `summary`는 사람이 빠르게 읽을 수 있는 1줄 요약 문자열이다.

## Internal Orchestration Helpers

아래 helper는 internal/private orchestration step이다. 구현상 테스트 편의를 위해 export될 수 있어도 canonical public pipeline surface에는 포함하지 않는다.

```typescript
async function reconstructTrace(
  deps: ReconstructPendingTracesDeps,
  trace_id: string,
): Promise<void>;

async function computeTraceVerdict(
  deps: ComputePendingVerdictsDeps,
  trace_id: string,
  options?: { force?: boolean },
): Promise<ComputeTraceVerdictResult>;
```

- `reconstructTrace()`는 단일 trace에 대해 `RecordStore.findByTraceId()` → `reconstruct()` → `GraphStore.upsert()` → `TraceStore.markReconstructed()`를 수행한다.
- `computeTraceVerdict()`는 단일 trace에 대해 session/scenario lookup → `compileSpec()` → `matchGraphs()` → `computeVerdict()` → `VerdictStore.insert()`를 수행한다. session이 없거나 scenarioId·scenarioSpec·graph가 없으면 에러 없이 `{ status: "skipped" }`를 반환한다.
- batch entrypoint는 각각 `reconstructPendingTraces(deps, options?)` 와 `computePendingVerdicts(deps, trace_ids, options?)`다.
- 각 trace 처리 중 에러가 발생하면 해당 trace를 DLQ에 삽입하고 `options.onError?.(traceId, error)`를 호출한 후 다음 trace를 계속 처리한다 (partial failure). `onError`가 없으면 조용히 계속 진행한다.
- `computePendingVerdicts`는 `options.force = true`이면 기존 verdict를 삭제하고 재계산한다.

## 제약 조건

- canonical signature에서는 boolean temporal flag를 사용하지 않고 `ReconstructionOptions.temporal_strategy` enum을 사용한다.
- `evaluateConstraints()`의 반환 타입은 boolean이 아니라 `ConstraintResult[]`다.
- verdict 계산은 `match_result` 단독이 아니라 `spec_graph`, `runtime_graph`, optional `qa_session_id`를 함께 받는 시그니처를 기준으로 한다.
