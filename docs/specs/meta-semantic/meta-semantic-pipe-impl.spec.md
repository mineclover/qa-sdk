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

# PipeSpec 구현 계획

## 목적 ^purpose

PipeFlow 12종 흐름 제어를 포함한 PipeSpec 타입 정의, 경로 계산, 검증,
ScenarioSpec 변환기를 구현한다. Phase 2의 핵심 산출물.

---

## 1. 구현 범위 및 파일 구조

### 패키지: `@qa-sdk/core` (기존 ScenarioSpec과 같은 위치)

```
packages/core/src/types/
  pipe-spec.ts         → PipeFlow 12종 타입 + PipeSpec 인터페이스

packages/core/src/
  pipe-path.ts         → 분기 경로 수 계산 (PipeSpec → totalPaths)
  pipe-path.test.ts
  pipe-validate.ts     → PipeSpec 구조 검증
  pipe-validate.test.ts
```

### 패키지: `definition-catalog` (compat 계층)

```
packages/definition-catalog/src/
  compat-scenario.ts      → ScenarioSpec → PipeSpec 변환기
  compat-scenario.test.ts
```

---

## 2. 타입 정의 (`pipe-spec.ts`)

### PipeSpec

```typescript
interface PipeSpec {
  pipeId: string;
  version: string;
  description?: string;

  /** 트리거 이벤트 */
  trigger: {
    eventKey: string;
    entryConditions?: Constraint[];
  };

  /** 패싯 흐름 (12종 흐름 제어) */
  flow: PipeFlow;

  /** scope×aspect 분류 */
  scope: string;
  aspect: string;

  /** 매니페스트 참조 */
  manifestVersion?: string;
}
```

### PipeFlow — 12종

```
기본:      PipeStep, PipeSequence
분기:      PipeBranch, PipeOptional
동시성:    PipeParallel, PipeRace, PipeAwait
내결함:    PipeRetry, PipeFallback
반복:      PipeLoop
트랜잭션:  PipeCompensate
비동기:    PipeEmit
```

### Constraint (기존 StepConstraint 재사용)

```typescript
interface Constraint {
  field: string;
  op: "eq" | "neq" | "exists" | "gt" | "lt" | "contains" | "masked";
  value?: unknown;
}
```

---

## 3. 경로 수 계산 (`pipe-path.ts`)

### 함수

```typescript
/** PipeFlow에서 도달 가능한 분기 경로 수를 계산한다 */
function countPaths(flow: PipeFlow): number
```

### 계산 규칙

| kind | 계산 | 이유 |
|------|------|------|
| step | 1 | 단일 실행 |
| sequence | Π steps[i] | 순차 도달 → 곱 |
| branch | Σ paths[i] | 조건부 → 합 |
| optional | countPaths(step) + 1 | 있는 경로 + 없는 경로 |
| parallel | Π steps[i] | 전부 실행 → 곱 |
| race | Σ steps[i] | 하나만 → 합 |
| await | countPaths(then) | 대기 후 then의 경로 |
| retry | countPaths(step) | 재시도 횟수 무관 |
| fallback | countPaths(try) + countPaths(catch) | 성공 + 실패 대안 |
| loop | countPaths(body) | 반복 횟수 무관 |
| compensate | countPaths(forward) + countPaths(compensate) | 정상 + 보상 |
| emit | 1 | 발행만, 후속 없음 |

### 테스트 케이스

```
1. step → 1
2. sequence([step, step]) → 1
3. branch([step, step]) → 2
4. optional(step) → 2
5. sequence([branch([step, step]), step]) → 2
6. parallel([step, step]) → 1
7. race([step, step]) → 2
8. fallback(step, step) → 2
9. compensate(step, step) → 2
10. 중첩: sequence([branch([A, B]), parallel([C, D])]) → 2
11. 실전: 주문 처리 파이프 (소비→관리→branch(생산|대기)→저장) → 2
```

---

## 4. 구조 검증 (`pipe-validate.ts`)

### 함수

```typescript
interface ValidationIssue {
  path: string;        // "flow.steps[0].paths[1]"
  severity: "error" | "warning";
  message: string;
}

function validatePipeSpec(spec: PipeSpec): ValidationIssue[]
```

### 검증 규칙

| 규칙 | 심각도 | 설명 |
|------|--------|------|
| empty-sequence | error | sequence.steps가 비어있음 |
| empty-branch | error | branch.paths가 비어있음 |
| empty-parallel | error | parallel.steps가 비어있음 |
| empty-race | error | race.steps가 비어있음 |
| retry-zero | error | retry.maxAttempts ≤ 0 |
| loop-no-limit | warning | loop.maxIterations 미설정 (무한 루프 위험) |
| missing-trigger | error | trigger.eventKey 비어있음 |
| missing-facet | warning | step.facet이 알려진 패싯이 아님 |
| deep-nesting | warning | 흐름 중첩 깊이 > 8 |
| compensate-in-emit | error | emit 내부에 compensate (의미 없음) |

---

## 5. ScenarioSpec → PipeSpec 변환 (`compat-scenario.ts`)

### 함수

```typescript
/** ScenarioSpec을 PipeSpec으로 변환. 변환 불가 시 에러 */
function scenarioToPipe(scenario: ScenarioSpec): PipeSpec

/** PipeSpec을 ScenarioSpec으로 역변환 (v1 호환 필요 시) */
function pipeToScenario(pipe: PipeSpec): ScenarioSpec
```

### 매핑 규칙

| ScenarioSpec | PipeSpec |
|---|---|
| `scenario_id` | `pipeId` |
| `version` | `version` |
| `entry_conditions` | `trigger.entryConditions` |
| `steps[0].event_key` | `trigger.eventKey` |
| step `kind: "sequence"` | PipeSequence |
| step `kind: "branch"` + `branches` | PipeBranch |
| step `kind: "optional"` | PipeOptional |
| step `constraints` | PipeStep.constraints |
| step `timeout_ms` | PipeStep.timeout |
| `required: false` | PipeOptional로 래핑 |

### 변환 불가 케이스

| ScenarioSpec 패턴 | 이유 |
|---|---|
| `next[]`로 구성된 임의 그래프 | PipeFlow는 트리 구조, 임의 그래프 불가 |
| step 간 순환 참조 | PipeFlow에 loop가 있지만 step ID 기반 순환은 미지원 |

→ 이 경우 수동 마이그레이션 필요. 변환기는 에러 반환.

---

## 6. 구현 순서

| 순서 | 파일 | 산출물 | 테스트 |
|------|------|--------|--------|
| 1 | `core/src/types/pipe-spec.ts` | 12종 타입 + PipeSpec | 타입 체크만 |
| 2 | `core/src/pipe-path.ts` | `countPaths()` | 11+ 케이스 |
| 3 | `core/src/pipe-validate.ts` | `validatePipeSpec()` | 10+ 규칙 |
| 4 | `definition-catalog/src/compat-scenario.ts` | 변환기 | 기존 ScenarioSpec 변환 검증 |
| 5 | `core/src/index.ts` | export 추가 | — |

### 의존 관계

```
pipe-spec.ts (타입)
  ↓
pipe-path.ts (경로 계산) — pipe-spec.ts 의존
pipe-validate.ts (검증) — pipe-spec.ts 의존
  ↓
compat-scenario.ts (변환) — pipe-spec.ts + scenario.ts 의존
```

---

## 7. 기존 코드 변경 없음

이 구현은 기존 ScenarioSpec, engine, ingest를 **전혀 건드리지 않는다.**
PipeSpec은 새 타입으로 추가되고, compat-scenario.ts가 양방향 변환을 제공한다.
Phase 3에서 engine을 PathMatcher로 전환할 때까지 기존 코드는 그대로 동작한다.
