---
def:
  id: meta-semantic-pipe-impl
  level: leaf
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: draft
  layer: domain
  links:
    - target: meta-semantic-v2-migration
      type: depends_on
    - target: ms-concept-pipe
      type: implements
---

# PipeSpec + PipeGraph 구현 계획

## 목적 ^purpose

PipeFlow 12종 흐름 제어를 포함한 PipeSpec(단일 노드), PipeGraph(노드 간 연결),
경로 계산, 검증을 구현한다. ScenarioSpec을 대체하는 Phase 2의 핵심 산출물.

---

## 1. 설계 구조

```
PipeSpec = 단일 실행 단위 (내부 패싯 흐름 트리)
  "이 파이프 안에서 패싯이 어떤 순서로 실행되는가"

PipeGraph = PipeSpec 노드들의 연결 그래프
  "파이프들이 어떤 순서로 연결되는가"
  ScenarioSpec을 대체하는 상위 구조

ScenarioSpec과의 관계:
  ScenarioSpec의 각 step ≈ 하나의 PipeSpec
  ScenarioSpec 전체 ≈ PipeGraph
```

---

## 2. 파일 구조

### 패키지: `@qa-sdk/core`

```
packages/core/src/types/
  pipe-spec.ts          → PipeFlow 12종 + PipeSpec + PipeGraph 타입

packages/core/src/
  pipe-path.ts          → countPaths() 단일 파이프 경로 수
  pipe-path.test.ts
  pipe-graph-path.ts    → countGraphPaths() 그래프 전체 경로 수
  pipe-graph-path.test.ts
  pipe-validate.ts      → validatePipeSpec() + validatePipeGraph()
  pipe-validate.test.ts
```

---

## 3. 타입 정의 (`pipe-spec.ts`)

### PipeSpec — 단일 노드

```typescript
interface PipeSpec {
  /** 파이프 노드 ID (그래프 내 유일) */
  pipeId: string;
  version: string;
  description?: string;

  /** 트리거: 이 파이프를 시작시키는 이벤트 */
  trigger: {
    eventKey: string;
    entryConditions?: Constraint[];
  };

  /** 내부 패싯 흐름 (12종 흐름 제어) */
  flow: PipeFlow;

  /** 생산 이벤트: 이 파이프가 완료 시 발생시키는 이벤트 */
  produces?: string[];

  /** scope×aspect 분류 */
  scope?: string;
  aspect?: string;
}
```

### PipeGraph — 노드 간 연결 (ScenarioSpec 대체)

```typescript
interface PipeGraph {
  /** 그래프 식별자 */
  graphId: string;
  version: string;
  description?: string;

  /** 그래프에 속한 파이프 노드들 */
  pipes: PipeSpec[];

  /** 노드 간 연결 */
  connections: PipeConnection[];

  /** 그래프 진입점 (첫 번째 트리거) */
  entryPipeId: string;

  /** 매니페스트 참조 */
  manifestVersion?: string;
}

/** 파이프 간 연결 (N:M 지원) */
interface PipeConnection {
  /** 출발 파이프 — 단일 또는 여러 소스 (join) */
  from: string | string[];

  /** 도착 파이프 — 단일 또는 여러 대상 (fan-out) */
  to: string | string[];

  /** 연결 유형 */
  kind: ConnectionKind;

  /** 조건 (conditional일 때) */
  condition?: string;
}

type ConnectionKind =
  | "next"          // from 완료 → to 시작 (순차)
  | "conditional"   // from 완료 + 조건 충족 → to 시작
  | "event"         // from.produces 이벤트 → to.trigger 매칭
  | "error"         // from 실패 → to 시작 (에러 핸들링)
  | "compensate"    // from 후속 실패 → to 보상 실행
  | "fan-out"       // from 완료 → to[] 동시 시작 (1:N)
  | "join";         // from[] 전부 완료 → to 시작 (N:1)
```

### PipeFlow — 12종 흐름 제어

```typescript
type PipeFlow =
  // 기본
  | PipeStep | PipeSequence
  // 분기
  | PipeBranch | PipeOptional
  // 동시성
  | PipeParallel | PipeRace | PipeAwait
  // 내결함
  | PipeRetry | PipeFallback
  // 반복
  | PipeLoop
  // 트랜잭션
  | PipeCompensate
  // 비동기
  | PipeEmit;

interface PipeStep {
  kind: "step";
  facet: string;          // 생산 | 소비 | 정의 | 관리 | 저장
  eventKey?: string;
  constraints?: Constraint[];
  timeout?: number;
}

interface PipeSequence {
  kind: "sequence";
  steps: PipeFlow[];
}

interface PipeBranch {
  kind: "branch";
  condition: string;
  paths: PipeFlow[];
}

interface PipeOptional {
  kind: "optional";
  step: PipeFlow;
}

interface PipeParallel {
  kind: "parallel";
  steps: PipeFlow[];
}

interface PipeRace {
  kind: "race";
  steps: PipeFlow[];
}

interface PipeAwait {
  kind: "await";
  condition: string;
  timeout?: number;
  then: PipeFlow;
}

interface PipeRetry {
  kind: "retry";
  step: PipeFlow;
  maxAttempts: number;
  backoff?: number;
}

interface PipeFallback {
  kind: "fallback";
  try: PipeFlow;
  catch: PipeFlow;
}

interface PipeLoop {
  kind: "loop";
  body: PipeFlow;
  until: string;
  maxIterations?: number;
}

interface PipeCompensate {
  kind: "compensate";
  forward: PipeFlow;
  compensate: PipeFlow;
}

interface PipeEmit {
  kind: "emit";
  eventKey: string;
  payload?: string;
}

interface Constraint {
  field: string;
  op: "eq" | "neq" | "exists" | "gt" | "lt" | "contains" | "masked";
  value?: unknown;
}
```

---

## 4. 경로 수 계산

### 단일 파이프 경로 (`pipe-path.ts`)

```typescript
function countPipePaths(flow: PipeFlow): number
```

| kind | 계산 | 이유 |
|------|------|------|
| step | 1 | 단일 실행 |
| sequence | Π steps[i] | 순차 → 곱 |
| branch | Σ paths[i] | 조건부 → 합 |
| optional | countPaths(step) + 1 | 있는 경로 + 없는 경로 |
| parallel | Π steps[i] | 전부 실행 → 곱 |
| race | Σ steps[i] | 하나만 → 합 |
| await | countPaths(then) | 대기 후 then |
| retry | countPaths(step) | 재시도 횟수 무관 |
| fallback | countPaths(try) + countPaths(catch) | 성공 + 대안 |
| loop | countPaths(body) | 반복 횟수 무관 |
| compensate | countPaths(forward) + countPaths(compensate) | 정상 + 보상 |
| emit | 1 | 발행만 |

### 그래프 전체 경로 (`pipe-graph-path.ts`)

```typescript
function countGraphPaths(graph: PipeGraph): number
```

그래프의 entryPipeId부터 시작하여 connections를 따라가며
각 PipeSpec의 경로 수를 곱/합산한다.

| connection kind | 계산 | 설명 |
|---|---|---|
| next | 곱 | 순차 도달 |
| conditional | 합 | 조건부 분기 |
| event | 곱 | 이벤트 체인 |
| error | 합 | 에러 대안 |
| compensate | 합 | 보상 경로 |
| fan-out | 곱 | 1→N 동시 실행, 전부의 경로 곱 |
| join | 1 | N→1 합류점, 합류 후 to의 경로만 |

---

## 5. 구조 검증 (`pipe-validate.ts`)

### PipeSpec 검증

```typescript
function validatePipeSpec(spec: PipeSpec): ValidationIssue[]
```

| 규칙 | 심각도 | 설명 |
|------|--------|------|
| empty-sequence | error | sequence.steps 비어있음 |
| empty-branch | error | branch.paths 비어있음 |
| empty-parallel | error | parallel.steps 비어있음 |
| empty-race | error | race.steps 비어있음 |
| retry-zero | error | maxAttempts ≤ 0 |
| loop-no-limit | warning | maxIterations 미설정 |
| missing-trigger | error | trigger.eventKey 비어있음 |
| missing-facet | warning | step.facet이 알려진 패싯 아님 |
| deep-nesting | warning | 중첩 깊이 > 8 |

### PipeGraph 검증

```typescript
function validatePipeGraph(graph: PipeGraph): ValidationIssue[]
```

| 규칙 | 심각도 | 설명 |
|------|--------|------|
| missing-entry | error | entryPipeId가 pipes에 없음 |
| dangling-connection | error | from/to가 존재하지 않는 pipeId |
| unreachable-pipe | warning | entry에서 도달 불가능한 파이프 |
| circular-next | error | next 연결에 순환 |
| duplicate-pipe-id | error | pipes 내 pipeId 중복 |
| event-mismatch | warning | kind=event인데 from.produces에 to.trigger.eventKey 없음 |
| fan-out-single | warning | kind=fan-out인데 to가 단일 값 (next로 충분) |
| join-single | warning | kind=join인데 from이 단일 값 (next로 충분) |
| join-incomplete | error | kind=join인데 from[] 중 일부가 entry에서 도달 불가능 |

---

## 6. 구현 순서

| 순서 | 파일 | 산출물 | 테스트 수 (예상) |
|------|------|--------|:---:|
| 1 | `core/src/types/pipe-spec.ts` | 타입: PipeFlow 12종 + PipeSpec + PipeGraph | 타입 체크 |
| 2 | `core/src/pipe-path.ts` | `countPipePaths()` | 12+ |
| 3 | `core/src/pipe-graph-path.ts` | `countGraphPaths()` | 8+ |
| 4 | `core/src/pipe-validate.ts` | `validatePipeSpec()` + `validatePipeGraph()` | 15+ |
| 5 | `core/src/index.ts` | export 추가 | — |

### 의존 관계

```
pipe-spec.ts (타입)
  ├── pipe-path.ts (단일 파이프 경로)
  ├── pipe-graph-path.ts (그래프 경로) → pipe-path.ts 의존
  └── pipe-validate.ts (검증) → pipe-path.ts 의존 (경로 수 검증 시)
```

---

## 7. 기존 코드 변경 없음

기존 ScenarioSpec, engine, ingest를 전혀 건드리지 않는다.
PipeSpec/PipeGraph는 새 타입으로 추가된다.
Phase 3에서 engine의 매칭을 PipeGraph 기반으로 전환할 때까지
기존 ScenarioSpec 코드는 그대로 동작한다.

---

## 8. ScenarioSpec과의 대응

| ScenarioSpec | PipeGraph |
|---|---|
| `scenario_id` | `graphId` |
| `version` | `version` |
| `entry_conditions` | `entryPipeId`의 PipeSpec.trigger.entryConditions |
| `steps[]` (flat list + next[]) | `pipes[]` (노드) + `connections[]` (엣지) |
| step.kind: sequence | connection.kind: next |
| step.kind: branch + branches[] | connection.kind: conditional |
| step.kind: optional | PipeSpec.flow에 PipeOptional 사용 |
| step.event_key | PipeSpec.trigger.eventKey |
| step.constraints | PipeSpec.flow 내 PipeStep.constraints |

PipeGraph가 ScenarioSpec보다 표현력이 높다:
- ScenarioSpec: step kind 3종 (sequence/branch/optional), 1:1 연결만
- PipeGraph: connection kind 7종 (fan-out/join 포함) + PipeFlow 12종 + N:M 연결

ScenarioSpec에서 표현 불가능했던 것:
- 동시 실행 후 합류 (fan-out → join)
- 에러 시 보상 (compensate)
- 재시도/폴백 (retry/fallback)
- 비동기 이벤트 발행 (emit)
- 반복 처리 (loop)
