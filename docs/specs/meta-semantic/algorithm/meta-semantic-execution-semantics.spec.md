---
def:
  id: meta-semantic-execution-semantics
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [structural]
  links:
    - target: meta-semantic-system
      type: depends_on
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: meta-semantic-v2-migration
      type: depends_on
  sources:
    - packages/core/src/types/pipe-spec.ts
    - packages/core/src/types/pipe-runtime.ts
    - packages/core/src/pipe/pipe-runtime.ts
    - packages/core/src/pipe/pipe-runtime.test.ts
    - packages/core/src/pipe/pipe-interpret.ts
    - packages/core/src/pipe/pipe-interpret.test.ts
    - packages/core/src/pipe/pipe-simulate.ts
    - packages/core/src/pipe/pipe-simulate.test.ts
    - packages/core/src/pipe/path-matcher.ts
    - packages/core/src/pipe/path-matcher.test.ts
---

# 실행 의미론 (Execution Semantics)

## 목적 ^purpose

PipeFlow/PipeGraph의 선언적 정의를 실제로 실행하는 규칙을 정의한다.
Phase 2(선언 + 시뮬레이션)와 Phase 3(런타임 실행)의 경계를 명확히 하고,
조건 평가, 에러 전파, 취소, 컨텍스트 전달의 실행 규칙을 정한다.

## 방법 ^method

**조건 표현 언어**가 branch/filter/await의 조건 문자열을 평가하고,
**에러 전파 모델**이 step 실패 시 상위 흐름으로의 전파 규칙을 정의하고,
**취소 모델**이 race/timeout에서 패자/초과 step의 중단을 정의하고,
**컨텍스트 전달**이 step 간 데이터 바인딩을 정의한다.

---

## 1. Phase 2 ↔ Phase 3 경계

### Phase 2 — 선언 + 시뮬레이션 (완료)

| 구현 | 파일 | 설명 |
|------|------|------|
| PipeFlow 30종 타입 | `core/src/types/pipe-spec.ts` | 흐름 제어 선언 |
| PipeGraph + ConnectionKind 8종 | 같은 파일 | 파이프 간 연결 선언 |
| countPipePaths / countGraphPaths | `core/src/pipe-path.ts` | 경로 수 계산 |
| validatePipeSpec / validatePipeGraph | `core/src/pipe-validate.ts` | 구조 검증 |
| serialize / deserialize | `core/src/pipe-serialize.ts` | JSON 직렬화 |
| MemoryPipeGraphStore | `core/src/pipe-store.ts` | CRUD 저장 |
| analyzePipeComplexity / findBottlenecks | `core/src/pipe-analyze.ts` | 정적 분석 |
| simulate() | `core/src/pipe-simulate.ts` | dry-run (resolver 기반) |

**Phase 2의 한계:** 시뮬레이션은 resolver 함수로 분기/실패를 결정한다.
실제 조건 평가, 실제 에러 전파, 실제 취소는 하지 않는다.

### Phase 3 — 런타임 실행 (설계 대상)

| 구현 대상 | 설명 |
|----------|------|
| ConditionEvaluator | 조건 문자열 평가 엔진 |
| ErrorPropagation | step 실패 → 상위 흐름 전파 규칙 |
| CancellationToken | race/timeout 패자 중단 |
| PipeContext | step 간 데이터 전달 |
| PipeRunner | PipeGraph 실제 실행 런타임 |
| PathMatcher | 실행 결과 ↔ PipeSpec 매칭 (VerdictReport 대체) |

---

## 2. 조건 표현 언어 (Condition Expression)

### 현재 문제

```typescript
{ kind: "branch", condition: "amount > 0", paths: [...] }
//                            ^^^^^^^^^^^^^^^^
//                            문자열. 평가 규칙 없음.
```

### 설계

조건은 **표현식 트리**로 정의한다. 문자열은 단축 표기.

```typescript
/** 조건 표현식 */
type ConditionExpr =
  | FieldCondition       // 필드 비교
  | LogicalCondition     // 논리 조합 (and/or/not)
  | ExistsCondition      // 존재 여부
  | EventCondition;      // 이벤트 발생 여부

interface FieldCondition {
  type: "field";
  field: string;         // "payload.amount", "context.user.role"
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "matches";
  value: unknown;
}

interface LogicalCondition {
  type: "and" | "or" | "not";
  children: ConditionExpr[];
}

interface ExistsCondition {
  type: "exists" | "not-exists";
  field: string;
}

interface EventCondition {
  type: "event-received";
  eventKey: string;
  timeout?: number;
}
```

### 단축 표기 → 표현식 변환

```
"amount > 0"         → { type: "field", field: "amount", op: "gt", value: 0 }
"status === 'ok'"    → { type: "field", field: "status", op: "eq", value: "ok" }
"user && user.role"  → { type: "and", children: [
                           { type: "exists", field: "user" },
                           { type: "exists", field: "user.role" }
                         ]}
```

### 평가 인터페이스

```typescript
interface ConditionEvaluator {
  /** 조건 평가. context에서 필드를 조회하여 결과 반환 */
  evaluate(expr: ConditionExpr, context: PipeContext): boolean;

  /** 단축 문자열 파싱 */
  parse(shorthand: string): ConditionExpr;
}
```

---

## 3. 에러 전파 모델 (Error Propagation)

### 현재 문제

시뮬레이션에서 `failureResolver`로 성공/실패를 외부에서 주입.
실제 실행에서는 step이 throw하거나 에러를 반환해야 함.

### 설계

```typescript
/** step 실행 결과 */
type StepResult =
  | { status: "ok"; output: unknown }
  | { status: "error"; error: StepError };

interface StepError {
  code: string;          // "TIMEOUT", "VALIDATION_FAILED", "NETWORK_ERROR"
  message: string;
  retryable: boolean;    // retry에서 재시도할 수 있는 에러인가
  context?: unknown;     // 디버깅 정보
}
```

### 전파 규칙

| 흐름 제어 | step 실패 시 동작 |
|----------|-----------------|
| `sequence` | 즉시 중단, 에러를 상위로 전파 |
| `parallel` | 다른 step도 취소, 첫 에러를 상위로 전파 |
| `race` | 실패는 무시, 다른 step이 성공하면 성공 |
| `retry` | `retryable: true`면 재시도, false면 즉시 전파 |
| `fallback` | try 실패 → catch 실행. catch도 실패하면 전파 |
| `finally` | body 실패해도 cleanup 실행. body 에러를 보존하여 전파 |
| `timeout` | 초과 시 `TIMEOUT` 에러. onTimeout 있으면 실행, 없으면 전파 |
| `compensate` | forward 후속 실패 → compensate 실행. compensate 실패 → 전파 |
| `circuit-breaker` | 개방 상태면 즉시 `CIRCUIT_OPEN` 에러 반환 |
| `loop` | body 에러 → 루프 중단, 에러 전파 |
| `feedback` | body 에러 → 루프 중단, 에러 전파 |
| `emit` | 에러 없음 (fire-and-forget) |
| `tap` | observe 에러는 무시 (관측은 흐름에 영향 없음) |

### 에러 계층

```
StepError (개별 step)
  ↓ 전파
FlowError (PipeFlow 레벨, 어떤 path에서 실패했는지 포함)
  ↓ 전파
PipeError (PipeSpec 레벨, pipeId + flowPath 포함)
  ↓ 연결 전파
GraphError (PipeGraph 레벨, 어떤 connection에서 실패했는지)
```

---

## 4. 취소 모델 (Cancellation)

### 현재 문제

race에서 승자가 결정되면 패자는? timeout 초과 시 진행 중인 body는?

### 설계

```typescript
/** 취소 토큰 — 협력적 취소 */
interface CancellationToken {
  /** 취소되었는가 */
  readonly cancelled: boolean;
  /** 취소 사유 */
  readonly reason?: string;
  /** 취소 요청 */
  cancel(reason: string): void;
  /** 취소 시 콜백 */
  onCancel(callback: () => void): void;
}
```

### 취소 규칙

| 흐름 제어 | 취소 발생 시점 | 취소 대상 |
|----------|-------------|----------|
| `race` | 승자 결정 시 | 나머지 step 전부 |
| `timeout` | duration 초과 시 | body |
| `parallel` | 하나라도 실패 시 | 나머지 step 전부 (fail-fast) |
| `circuit-breaker` | 회로 개방 시 | step 실행 자체를 건너뜀 |
| `loop` | until 조건 충족 시 | body의 현재 반복 (다음 반복 안 함) |
| `feedback` | until 조건 충족 시 | body의 현재 반복 |

### 취소의 전파

취소는 **하향 전파**만 한다 (상위 → 하위). 하위가 상위를 취소하지 않는다.

```
race
  ├── step A (승자) → 완료
  ├── step B → 취소 (token.cancel("race winner decided"))
  └── step C → 취소
```

---

## 5. 컨텍스트 전달 (PipeContext)

### 현재 문제

step 간 데이터가 어떻게 전달되는가? `StepDataContract`는 선언만.

### 설계

```typescript
/** 파이프 실행 컨텍스트 — step 간 데이터 전달 */
interface PipeContext {
  /** step 간 공유 데이터 */
  data: Record<string, unknown>;

  /** 원본 트리거 이벤트 */
  triggerEvent: { eventKey: string; payload?: Record<string, unknown> };

  /** 이전 step의 출력 */
  previousOutput?: unknown;

  /** 메타데이터 */
  pipeId: string;
  graphId?: string;
  manifestVersion?: string;

  /** 취소 토큰 */
  cancellation: CancellationToken;

  /** 필드 조회 (조건 평가에 사용) */
  get(path: string): unknown;

  /** 필드 설정 (step 출력 저장) */
  set(path: string, value: unknown): void;
}
```

### 데이터 흐름

```
트리거 이벤트 payload
  → PipeContext.data에 초기화
    → step[0] 실행 → 출력을 context.set()
      → step[1] 실행 → context.get()으로 이전 출력 조회
        → ...

branch:
  context를 복제하여 각 경로에 전달 (경로 간 격리)

parallel:
  context를 복제하여 각 step에 전달
  전부 완료 후 결과를 병합

join:
  모든 from의 context를 병합하여 to에 전달
```

---

## 6. 구현 완료

### Phase 3 런타임 구현

| 구현 | 파일 | 테스트 |
|------|------|--------|
| ConditionExpr + parseCondition + evaluateCondition | `core/src/pipe-runtime.ts` | 10 tests |
| CancellationToken (협력적 취소 + child 전파) | 같은 파일 | 5 tests |
| PipeContext (get/set/clone + 중첩 경로) | 같은 파일 | 4 tests |
| ExecutorRegistry (facet별 실행기) | 같은 파일 | — |
| PipeRunner (run + 에러 전파 + 이벤트 체인) | 같은 파일 | 10 tests |
| 타입: StepResult, StepError, ExecutedStep, RunResult | `core/src/types/pipe-runtime.ts` | 타입 체크 |

> 타입 상세: `core/src/types/pipe-runtime.ts` 참조
> 구현 상세: `core/src/pipe-runtime.ts` 참조

---

## 7. PathMatcher — 실행 결과 매칭 (구현 완료)

실행 결과(RunResult)와 PipeSpec을 매칭하여 어떤 경로가 실행되었는지 판정.
기존 VerdictReport(ScenarioSpec 기반)를 대체.

| VerdictReport (v1) | PathMatcher (v2) |
|---|---|
| ScenarioSpec 기반 | PipeGraph 기반 |
| step 순서 매칭 | 경로 매칭 (합산 모델) |
| 6상태 | scope×aspect 검증 전략 기반 판정 |

### 구현

| 구현 | 파일 | 테스트 |
|------|------|--------|
| matchPath() | `packages/core/src/path-matcher.ts` | 8 tests (`path-matcher.test.ts`) |

---

## 8. 런타임 안정화 (Runtime Stabilization)

PipeRunner 실행 중 호출 빈도·중복·조건을 제어하는 안정화 메커니즘.

| 전략 | 설명 |
|------|------|
| `throttle` | interval 내 호출 횟수를 제한 (rate limiting). 호출 추적 포함 |
| `debounce` | delay 경과 후 실행 (마지막 호출 기준 대기) |
| `dedup` | Map 기반 keyField 중복 제거. TTL 만료 시 자동 해제 |
| `filter` | condition이 false면 실행 건너뜀. ExecutedStep status = `"skipped"` |

---

## 9. 범위 경계 요약

```
Phase 2 (완료 — 선언적):
  PipeFlow 30종 + ConnectionKind 8종 + simulate() + analyze()
  → 구현: core/src/pipe-*.ts

Phase 3 (완료 — 실행적):
  ConditionEvaluator + CancellationToken + PipeContext + PipeRunner
  → 구현: core/src/pipe-runtime.ts (29 tests)

Phase 3 추가 (완료):
  PathMatcher (실행 결과 ↔ PipeSpec 매칭)
  → 구현: packages/core/src/path-matcher.ts (8 tests)

  런타임 안정화 (throttle, debounce, dedup, filter)
  → 구현: core/src/pipe-runtime.ts
```
