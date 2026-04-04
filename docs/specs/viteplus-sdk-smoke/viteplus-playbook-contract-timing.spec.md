---
def:
  id: viteplus-playbook-contract-timing
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: experience
  svc: viteplus-sdk-smoke
  tags: [frontend, structural, testing]
  links:
    - target: viteplus-sdk-smoke-system
      type: refines
    - target: viteplus-playbook-mount-flow
      type: refines
    - target: viteplus-playbook-provider-patterns
      type: depends_on
    - target: pipe-simulate
      type: depends_on
---

# Vite+ Playbook Contract Timing — 계약 위임 시점 분석

## 목적 ^purpose

scope 계약의 **시간적 가용성**을 모델링한다. 구조적으로 계약이 선언되어 있어도 데이터가 준비되지 않은 시점, 하위→상위 역방향 위임의 완료 시점을 분석하고 시뮬레이션에서 검출 가능하게 만든다.

## 정의 ^defines

- **contract readiness** — 계약의 데이터가 실제로 사용 가능해지는 시점
- **pending contract** — 구조적으로 선언되었지만 데이터 미준비 상태
- **reverse delegation** — 하위 scope가 상위 scope의 계약 데이터를 갱신하는 패턴
- **delegation gap** — 역방향 위임 요청~완료 사이의 데이터 불일치 구간

## 소비 ^consumes

- `ContractRef` / `ScopeNesting` / `validateMountFlow()` (`@qa-sdk/core`)
- `simulate()` / `SimulationResult` — 이벤트 체인의 시간 추적 (`@qa-sdk/core`)

## 문제 분석

### 1. 비동기 초기화 지연

구조적 마운트와 데이터 준비 사이에 gap이 있다:

```
feature-context 마운트 (t1)
  │ provides: playbook-state (구조적 선언)
  │ BUT: persist.load() 아직 진행 중
  │
  ├── handlers 마운트 (t2) — playbook-state를 소비하려 하지만 빈 state
  │
  └── persist.load() 완료 (t3) — playbook-state 데이터 준비됨
```

`validateMountFlow()`는 t2에서 통과 (구조적 가용). 하지만 t2~t3 사이에 handlers가 빈 state로 동작.

### 2. 역방향 위임 (하위→상위)

하위 scope가 상위 scope의 계약 데이터를 변경한다:

```
handlers scope (depth 2)
  │ submit → async persist 호출
  │ playbook-state.status = "submitting"
  │
  ├── persist 처리 중 (t3~t4)
  │   └── view는 여전히 이전 state를 봄 (stale)
  │
  └── persist 완료 (t4)
      └── playbook-state.status = "success"
      └── view 리렌더
```

이 delegation gap(t3~t4) 동안 view가 stale data로 렌더링됨.

### 3. 계약 위임 체인의 지연 전파

```
handlers → feature-context(state 갱신) → view(리렌더)
                 ↑ async gap              ↑ 지연 전파
```

gap이 체인을 따라 누적될 수 있음.

## 타입 설계

### ContractRef 확장 — readiness 선언

```typescript
interface ContractRef {
  contractId: string;
  type: "state" | "logging" | "persist" | "adapter" | "custom";
  shape?: string;
  override?: boolean;
  required?: boolean;

  /** 이 계약의 데이터가 준비되는 시점 (이벤트 키) */
  readyAfter?: string;
  /** 이 계약이 역방향 위임을 받는가 */
  acceptsReverseDelegation?: boolean;
}
```

### ScopePipeBinding 확장 — 위임 선언

```typescript
interface ScopePipeBinding {
  scopeId: string;
  scopeContracts: string[];

  /** 이 pipe가 상위 scope 계약에 역방향 위임하는 목록 */
  delegatesTo?: Array<{
    contractId: string;
    /** 위임 완료를 알리는 이벤트 */
    completionEvent: string;
    /** 위임 중 데이터 불일치를 허용하는가 (기본: false) */
    tolerateStale?: boolean;
  }>;
}
```

### TimingIssue — 시점 검증 결과

```typescript
type TimingIssueCode =
  | "consume-before-ready"      // 계약 데이터 준비 전에 소비
  | "delegation-gap"            // 역방향 위임 중 stale data 노출
  | "readiness-event-missing"   // readyAfter 이벤트가 시뮬 결과에 없음
  | "completion-event-missing"; // delegatesTo의 completionEvent가 시뮬 결과에 없음

interface TimingIssue {
  severity: "error" | "warning";
  code: TimingIssueCode;
  pipeId: string;
  contractId: string;
  message: string;
}
```

## 검증 함수

```typescript
/**
 * 계약 시점 검증 — 시뮬레이션 결과와 마운트 바인딩을 교차 분석.
 *
 * 1. readyAfter가 있는 계약: 해당 이벤트가 producedEvents에 나타난 후에야 소비 가능
 * 2. delegatesTo가 있는 pipe: completionEvent가 producedEvents에 있는지 확인
 * 3. delegation gap: 위임 시작~완료 사이에 해당 계약을 소비하는 다른 pipe가 있는지
 */
function validateContractTiming(
  binding: MountFlowBinding,
  simResult: SimulationResult,
): TimingValidation;

interface TimingValidation {
  valid: boolean;
  issues: TimingIssue[];
  /** 계약별 준비 시점 (이벤트 인덱스) */
  readinessTimeline: Array<{
    contractId: string;
    readyAtStep: number;  // -1이면 즉시, 양수면 해당 step 이후
  }>;
  /** 역방향 위임의 gap 분석 */
  delegationGaps: Array<{
    contractId: string;
    delegatorPipeId: string;
    gapStartStep: number;
    gapEndStep: number;
    staleConsumers: string[];  // gap 동안 해당 계약을 소비하는 pipe
  }>;
}
```

## 적용 예시

### 비동기 초기화

```typescript
const nesting: ScopeNesting = {
  scopes: [
    { scopeId: "qa-bridge", provides: [{ contractId: "logging-session", type: "logging" }], consumes: [] },
    {
      scopeId: "feature-context",
      provides: [
        {
          contractId: "playbook-state", type: "state",
          readyAfter: "persist_load_complete",  // ← 이 이벤트 후 준비됨
        },
      ],
      consumes: [],
    },
    // ...
  ],
};
```

시뮬 결과에서 `persist_load_complete` 이벤트가 `form_submit` 이벤트보다 뒤에 있으면:
→ handlers가 form_submit 시점에 playbook-state를 소비 → `consume-before-ready` error

### 역방향 위임

```typescript
const bindings = {
  "submit-handler": {
    scopeId: "handlers",
    scopeContracts: ["playbook-state", "logging-session"],
    delegatesTo: [{
      contractId: "playbook-state",
      completionEvent: "submit_persist_complete",
      tolerateStale: false,
    }],
  },
};
```

시뮬 결과에서 `submit_persist_complete` 이전에 view가 playbook-state를 소비하는 step이 있으면:
→ `delegation-gap` warning (tolerateStale: false이면 error)

## 검증 시퀀스 위치

```
L3   동적 경로      simulate() — pipe 실행 순서 + 이벤트 타임라인
     │
L2   상태 전이      transition() — PlaybookStatus
     │
L1.5 마운트 흐름    validateMountFlow() — 구조적 계약 가용성
     │
     │   ↘ 교차 검증
     │     validateContractTiming(binding, simResult)
     │     — L1.5의 바인딩 + L3의 시뮬 결과를 합쳐서 시점 분석
     │
L1   정적 구조      validateScopeNesting()
     │
L0   운영 상태      SimulationGuards
```

`validateContractTiming`은 L1.5와 L3를 **교차**하는 검증. 독립 계층이 아니라 두 계층의 결과를 입력으로 받는 브릿지 검증.

## 구현 우선순위

| 순서 | 항목 | 이유 |
|------|------|------|
| 1 | `readyAfter` + `consume-before-ready` 검증 | 비동기 초기화 검출이 가장 실용적 |
| 2 | `delegatesTo` + `delegation-gap` 검증 | 역방향 위임 stale data 검출 |
| 3 | `readinessTimeline` 산출 | 계약별 준비 시점 시각화 |
| 4 | `delegationGaps` 산출 | gap 구간 + stale consumer 목록 |
