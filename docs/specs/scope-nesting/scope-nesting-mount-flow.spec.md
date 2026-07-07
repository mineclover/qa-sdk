---
def:
  tier: component
  id: scope-nesting-mount-flow
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [frontend, structural, testing]
  links:
    - target: scope-nesting-system
      type: refines
    - target: scope-nesting-guide
      type: depends_on
    - target: scope-nesting-provider-patterns
      type: depends_on
    - target: scope-nesting-simulation-layers
      type: depends_on
    - target: pipe-simulate
      type: depends_on
sources:
  - packages/core/src/scope-nesting-mount.ts
  - packages/core/src/scope-nesting-mount.test.ts
  - packages/core/src/scope-nesting.ts
  - packages/core/src/pipe/pipe-simulate.ts
---

# Vite+ Playbook Mount Flow — scope↔pipe 브릿지

## 목적 ^purpose

scope nesting(L1)과 pipe simulation(L3) 사이의 누락된 연결을 정의한다. scope 마운트 순서가 계약 가용성의 시간축을 형성하고, pipe가 실행될 때 해당 시점의 활성 계약만 사용 가능하다는 제약을 검증 가능하게 만든다.

## 정의 ^defines

- **MountFlow** — scope 마운트 순서에 따른 계약 가용성 타임라인
- **ScopedPipe** — pipe가 어느 scope에서 실행되는지 선언
- **validateMountFlow()** — pipe의 계약 의존이 마운트 시점에 충족되는지 검증

## 소비 ^consumes

- `ScopeNesting` / `resolveContracts()` (`@qa-sdk/core`)
- `PipeSpec` / `PipeGraph` / `StepDataContract` (`@qa-sdk/core`)

## 분석: 두 세계의 차이

### scope 계약 (L1) — "무엇이 가용한가"

scope가 마운트되면 provides 계약이 활성화된다. depth 순서 = 마운트 순서.

```
depth 0: qa-bridge 마운트      → { logging-session }
depth 1: feature-context 마운트 → { logging-session, playbook-state, persist-adapter }
depth 2: handlers 마운트        → { logging-session, playbook-state, persist-adapter, submission-handlers }
depth 3: view 마운트            → 모든 계약 활성 (소비만)
```

각 depth에서의 **활성 계약 집합**이 해당 scope에서 실행되는 pipe의 전제 조건.

### pipe 이벤트 (L3) — "무엇이 실행되는가"

pipe는 이벤트 체인으로 트리거되고, 내부 step이 패싯을 실행한다.

```
form_submit → validate-input(소비→관리) → validation_result
  → compute-result(소비→생산) → review_complete
    → log-event(tap: 소비)
```

### 연결점: pipe가 scope 안에서 실행된다

```
handlers scope (depth 2) {
  활성 계약: { logging-session, playbook-state, submission-handlers }

  validate-input pipe:
    step "소비" — playbook-state 계약에서 draft 읽기
    step "관리" — validation 실행

  compute-result pipe:
    step "소비" — validation_result 이벤트에서 읽기
    step "생산" — result 계산, playbook-state에 기록

  log-event pipe:
    tap "소비" — logging-session 계약으로 이벤트 기록
}
```

## 타입 설계

### ScopedPipe — pipe의 scope 소속 선언

PipeSpec에 scopeId를 추가하지 않고, 별도 매핑으로 관리. PipeSpec은 범용이므로 scope-nesting 의존을 넣지 않는다.

```typescript
/** scope 계약 참조 — required 플래그 포함 */
interface ScopeContractRef {
  contractId: string;
  /** 필수 여부 (기본: true). false이면 미활성 시 warning만 */
  required?: boolean;
}

/** pipe → scope 매핑 */
interface ScopePipeBinding {
  /** pipe가 실행되는 scope */
  scopeId: string;
  /** pipe가 소비하는 scope 계약 (string이면 required: true) */
  scopeContracts: Array<string | ScopeContractRef>;
}

/** scope nesting + pipe graph를 연결하는 매핑 */
interface MountFlowBinding {
  nesting: ScopeNesting;
  graph: PipeGraph;
  /** pipeId → ScopePipeBinding */
  bindings: Record<string, ScopePipeBinding>;
}
```

### MountSnapshot — 특정 depth에서의 활성 계약

```typescript
interface MountSnapshot {
  /** scope depth */
  depth: number;
  scopeId: string;
  /** 이 depth까지 누적된 활성 계약 */
  activeContracts: string[];
  /** 이 scope에서 실행되는 pipe 목록 */
  pipes: string[];
}
```

### MountFlowIssue — 연결 검증 결과

```typescript
type MountFlowIssueCode =
  | "unbound-pipe"            // pipe에 scope binding 없음
  | "contract-unavailable"    // pipe가 소비하는 계약이 해당 depth에서 미활성
  | "scope-not-found"         // binding의 scopeId가 nesting에 없음
  | "pipe-not-found";         // binding의 pipeId가 graph에 없음

interface MountFlowIssue {
  severity: "error" | "warning";
  code: MountFlowIssueCode;
  pipeId: string;
  scopeId: string;
  contractId?: string;
  message: string;
}
```

## 검증 함수

```typescript
/**
 * mount flow 검증 — pipe의 scope 계약 의존이 마운트 시점에 충족되는지 확인.
 *
 * 1. 각 depth에서 활성 계약 집합 계산 (scope provides 누적)
 * 2. 각 pipe의 binding에서 scopeId → depth 조회
 * 3. pipe의 scopeContracts가 해당 depth의 활성 계약에 포함되는지 확인
 */
function validateMountFlow(
  binding: MountFlowBinding,
  guards?: SimulationGuards,
): MountFlowValidation;

interface MountFlowValidation {
  valid: boolean;
  issues: MountFlowIssue[];
  /** depth별 활성 계약 스냅샷 */
  snapshots: MountSnapshot[];
}
```

## 적용 예시

```typescript
const binding: MountFlowBinding = {
  nesting: playbookNesting,
  graph: handlerGraph,
  bindings: {
    "validate-input": {
      scopeId: "handlers",
      scopeContracts: ["playbook-state"],
    },
    "compute-result": {
      scopeId: "handlers",
      scopeContracts: ["playbook-state"],
    },
    "log-event": {
      scopeId: "handlers",
      scopeContracts: ["logging-session"],
    },
  },
};

const result = validateMountFlow(binding);
// result.valid === true
// result.snapshots:
//   depth 0 (qa-bridge):       activeContracts: ["logging-session"]
//   depth 1 (feature-context): activeContracts: ["logging-session", "playbook-state", "persist-adapter"]
//   depth 2 (handlers):        activeContracts: [..., "submission-handlers"], pipes: ["validate-input", "compute-result", "log-event"]
//   depth 3 (view):            activeContracts: [all]
```

## 언마운트 시나리오

qa-bridge가 언마운트되면 logging-session이 비활성화.
log-event pipe의 scopeContracts에 "logging-session"이 있으므로 `contract-unavailable` error.

이는 L0 guard의 `isEncodable`로도 표현 가능:
```typescript
validateMountFlow(binding, { isEncodable: (c) => c !== "logging-session" });
// → log-event: contract-unavailable error
```

## 전체 검증 시퀀스 (L0 → L1 → L1.5 → L3)

```typescript
// L0: 운영 상태 guard
const guards = { isEncodable: (c) => gateEngine.isActive(c) };

// L1: 정적 구조 검증
const nestingResult = validateScopeNesting(nesting, guards);
assert(nestingResult.valid);

// L1.5: 마운트 흐름 검증 — scope↔pipe 연결
const mountResult = validateMountFlow({ nesting, graph: handlerGraph, bindings }, guards);
assert(mountResult.valid);

// L2: 상태 전이 검증
const t = transition("editing", "valid-submit");
assert(!isViolation(t));

// L3: 동적 경로 검증
const sim = simulate({ graph: handlerGraph, initialEvent: { eventKey: "form_submit" } });
assert(sim.status === "complete");
```
