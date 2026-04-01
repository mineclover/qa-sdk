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
  | "join"          // from[] 전부 완료 → to 시작 (N:1)
  | "feedback";     // from 출력 → to 입력 (폐루프, 이벤트 기반 재트리거)
```

### PipeFlow — 31종 흐름 제어

```typescript
type PipeFlow =
  // ── 기본 (2) ──
  | PipeStep          // 개별 패싯 실행
  | PipeSequence      // 순차 (A → B)
  // ── 분기 (2) ──
  | PipeBranch        // 조건부 분기 (A → B | C)
  | PipeOptional      // 선택적 (A → B?)
  // ── 동시성 (3) ──
  | PipeParallel      // 동시 실행, 전부 대기 (Promise.all)
  | PipeRace          // 동시 실행, 먼저 완료만 (Promise.race)
  | PipeAwait         // 조건 충족까지 대기 → 실행
  // ── 내결함 (2) ──
  | PipeRetry         // 실패 시 재시도
  | PipeFallback      // 실패 시 대안 (try/catch)
  // ── 반복 (1) ──
  | PipeLoop          // 조건 충족까지 반복
  // ── 트랜잭션 (1) ──
  | PipeCompensate    // 후속 실패 시 롤백 (saga)
  // ── 비동기 (1) ──
  | PipeEmit          // 결과 안 기다리고 발행 (fire-and-forget)
  // ── 정리 (1) ──
  | PipeFinally       // 성공/실패 무관 항상 실행 (cleanup)
  // ── 시간 (1) ──
  | PipeTimeout       // 전체 흐름 시간 제한 래퍼
  // ── 제어 (1) ──
  | PipeFeedback      // 출력이 입력으로 되돌아감 (폐루프)
  // ── 배치 (4) ──
  | PipeMap           // 컬렉션 각 항목에 흐름 적용
  | PipeReduce        // 여러 결과를 하나로 집계
  | PipeBuffer        // N개/T시간 모아서 한 번에 처리
  | PipeFilter        // 조건 만족 항목만 통과 (탈락은 소멸)
  // ── 안정화 (3) ──
  | PipeCircuitBreaker // N회 실패 → 쿨다운 → 반개방 → 재시도
  | PipeThrottle      // 실행 빈도 제한 (N/초)
  | PipeDebounce      // 빠른 반복 무시, 마지막만 실행
  // ── 데이터 변환 (2) ──
  | PipeSplit         // 하나의 데이터를 여러 개로 분할
  | PipeEnrich        // 외부 소스에서 데이터 보강
  // ── 관측 (1) ──
  | PipeTap           // 흐름에 영향 없이 관측 (wire-tap)
  // ── 스트리밍 (2) ──
  | PipeResequence    // 순서 복원 (비동기 메시지 재정렬)
  | PipeWindow        // 시간/개수 기반 윈도우 (슬라이딩/텀블링/세션)
  // ── 상태 (2) ──
  | PipeDedup         // 중복 이벤트 제거
  | PipeCorrelation;  // 요청/응답 상관 관계 매칭

// ── 기본 ──────────────────────────────────────────────

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

// ── 분기 ──────────────────────────────────────────────

interface PipeBranch {
  kind: "branch";
  condition: string;
  paths: PipeFlow[];
}

interface PipeOptional {
  kind: "optional";
  step: PipeFlow;
}

// ── 동시성 ────────────────────────────────────────────

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

// ── 내결함 ────────────────────────────────────────────

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

// ── 반복 ──────────────────────────────────────────────

interface PipeLoop {
  kind: "loop";
  body: PipeFlow;
  until: string;
  maxIterations?: number;
}

// ── 트랜잭션 ──────────────────────────────────────────

interface PipeCompensate {
  kind: "compensate";
  forward: PipeFlow;
  compensate: PipeFlow;
}

// ── 비동기 ────────────────────────────────────────────

interface PipeEmit {
  kind: "emit";
  eventKey: string;
  payload?: string;
}

// ── 정리 ──────────────────────────────────────────────

interface PipeFinally {
  kind: "finally";
  body: PipeFlow;          // 메인 흐름
  cleanup: PipeFlow;       // 항상 실행
}

// ── 시간 ──────────────────────────────────────────────

interface PipeTimeout {
  kind: "timeout";
  body: PipeFlow;          // 시간 제한을 받는 흐름
  duration: number;        // 제한 시간 (ms)
  onTimeout?: PipeFlow;    // 타임아웃 시 대안 실행 (없으면 에러)
}

// ── 제어 ──────────────────────────────────────────────

interface PipeFeedback {
  kind: "feedback";
  body: PipeFlow;          // 실행할 흐름
  feedbackEvent: string;   // body 결과를 이 이벤트로 재주입
  until: string;           // 종료 조건 (수렴 판정)
  maxIterations?: number;  // 무한 루프 방지
}

// ── 배치 ──────────────────────────────────────────────

interface PipeMap {
  kind: "map";
  itemFlow: PipeFlow;      // 각 항목에 적용할 흐름
  collection: string;      // 입력 컬렉션 참조
  concurrency?: number;    // 동시 처리 수 (기본 1 = 순차)
}

interface PipeReduce {
  kind: "reduce";
  step: PipeFlow;          // 각 항목에 대한 누적 연산
  initial: string;         // 초기값 표현식
  accumulator: string;     // 누적 변수명
}

interface PipeBuffer {
  kind: "buffer";
  body: PipeFlow;          // 버퍼된 배치에 적용할 흐름
  count?: number;          // 개수 기반 (N개 모이면 flush)
  duration?: number;       // 시간 기반 (T ms마다 flush)
}

interface PipeFilter {
  kind: "filter";
  condition: string;       // 통과 조건 (만족하면 통과, 불만족 소멸)
  step: PipeFlow;          // 통과한 항목에 적용할 흐름
}

// ── 안정화 ────────────────────────────────────────────

interface PipeCircuitBreaker {
  kind: "circuit-breaker";
  step: PipeFlow;          // 보호 대상 흐름
  failureThreshold: number; // 실패 N회 → 회로 개방
  cooldown: number;         // 쿨다운 (ms) → 반개방
  halfOpenAttempts?: number; // 반개방 시 시도 횟수 (기본 1)
}

interface PipeThrottle {
  kind: "throttle";
  step: PipeFlow;          // 빈도 제한 대상
  rate: number;            // 허용 횟수
  interval: number;        // 시간 간격 (ms) — rate/interval
}

interface PipeDebounce {
  kind: "debounce";
  step: PipeFlow;          // 실행 대상
  wait: number;            // 대기 시간 (ms) — 마지막 트리거 후 wait 동안 추가 없으면 실행
}

// ── 데이터 변환 ───────────────────────────────────────

interface PipeSplit {
  kind: "split";
  splitBy: string;         // 분할 기준 (필드명 또는 표현식)
  itemFlow: PipeFlow;      // 분할된 각 항목에 적용할 흐름
}

interface PipeEnrich {
  kind: "enrich";
  source: string;          // 보강 데이터 소스 (서비스, DB 등)
  mergeField: string;      // 보강 결과를 병합할 필드
  step: PipeFlow;          // 보강 후 실행할 흐름
  timeout?: number;
}

// ── 관측 ──────────────────────────────────────────────

interface PipeTap {
  kind: "tap";
  observe: PipeFlow;       // 관측 행위 (로깅, 메트릭 등)
  step: PipeFlow;          // 메인 흐름 (tap은 이 흐름에 영향 없음)
}

// ── 스트리밍 ──────────────────────────────────────────

interface PipeResequence {
  kind: "resequence";
  orderBy: string;         // 정렬 기준 필드
  windowSize: number;      // 재정렬 윈도우 크기
  step: PipeFlow;          // 정렬된 항목에 적용할 흐름
}

interface PipeWindow {
  kind: "window";
  type: "tumbling" | "sliding" | "session";
  size: number;            // 윈도우 크기 (개수 또는 ms)
  slide?: number;          // sliding일 때 슬라이드 간격
  gap?: number;            // session일 때 유휴 갭 (ms)
  body: PipeFlow;          // 윈도우 내 항목에 적용할 흐름
}

// ── 상태 ──────────────────────────────────────────────

interface PipeDedup {
  kind: "dedup";
  keyField: string;        // 중복 판단 키 필드
  ttl?: number;            // 중복 기억 기간 (ms, 없으면 영구)
  step: PipeFlow;          // 중복 아닌 항목에 적용할 흐름
}

interface PipeCorrelation {
  kind: "correlation";
  requestEvent: string;    // 요청 이벤트 키
  responseEvent: string;   // 응답 이벤트 키
  correlationKey: string;  // 매칭 키 필드
  timeout?: number;        // 응답 대기 시간
  onMatch: PipeFlow;       // 매칭 시 실행
  onTimeout?: PipeFlow;    // 타임아웃 시 실행
}

// ── 공통 ──────────────────────────────────────────────

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
| finally | countPaths(body) | cleanup은 항상 실행 (분기 아님) |
| timeout | countPaths(body) + (onTimeout ? countPaths(onTimeout) : 1) | 정상 + 타임아웃 대안 |
| feedback | countPaths(body) | 반복 횟수 무관 |
| map | countPaths(itemFlow) | 항목 수 무관 (흐름 자체의 경로) |
| reduce | countPaths(step) | 누적 횟수 무관 |
| buffer | countPaths(body) | 배치 크기 무관 |
| filter | countPaths(step) + 1 | 통과 경로 + 탈락(소멸) 경로 |
| circuit-breaker | countPaths(step) + 1 | 정상 + 개방(차단) 경로 |
| throttle | countPaths(step) | 빈도 제한은 경로 분기 아님 |
| debounce | countPaths(step) | 대기 후 실행, 경로 분기 아님 |
| split | countPaths(itemFlow) | 분할 수 무관 |
| enrich | countPaths(step) | 보강은 경로 분기 아님 |
| tap | countPaths(step) | 관측은 경로 분기 아님 |
| resequence | countPaths(step) | 재정렬은 경로 분기 아님 |
| window | countPaths(body) | 윈도우 크기 무관 |
| dedup | countPaths(step) + 1 | 통과 + 중복(소멸) |
| correlation | countPaths(onMatch) + (onTimeout ? countPaths(onTimeout) : 1) | 매칭 + 타임아웃 |

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
| feedback | countPaths(to) | 폐루프 재트리거, 반복 횟수 무관 |

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
| feedback-no-limit | warning | feedback.maxIterations 미설정 (무한 루프 위험) |
| timeout-zero | error | timeout.duration ≤ 0 |
| finally-in-emit | error | emit 내부에 finally (의미 없음) |

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
| feedback-no-convergence | warning | kind=feedback인데 종료 조건 없음 (무한 재트리거) |

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
- PipeGraph: ConnectionKind 8종 + PipeFlow 15종 + N:M 연결

ScenarioSpec에서 표현 불가능했던 것:
- 동시 실행 후 합류 (fan-out → join)
- 에러 시 보상 (compensate)
- 재시도/폴백 (retry/fallback)
- 비동기 이벤트 발행 (emit)
- 반복 처리 (loop)
- 피드백 루프 (feedback — 폐루프 제어)
- 성공/실패 무관 정리 (finally)
- 전체 흐름 시간 제한 (timeout 래퍼)
