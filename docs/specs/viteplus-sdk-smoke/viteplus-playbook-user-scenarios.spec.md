---
def:
  id: viteplus-playbook-user-scenarios
  type: knowledge
  knowledge_kind: guide
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  layer: experience
  svc: viteplus-sdk-smoke
  tags: [entry-point, frontend, testing]
  links:
    - target: viteplus-sdk-smoke-system
      type: refines
    - target: platform-sdk-user-scenarios
      type: depends_on
    - target: viteplus-playbook-scope-nesting
      type: depends_on
    - target: viteplus-playbook-provider-patterns
      type: depends_on
    - target: viteplus-playbook-mount-flow
      type: depends_on
    - target: viteplus-playbook-contract-timing
      type: depends_on
    - target: viteplus-playbook-template-flow
      type: depends_on
---

# Vite+ Playbook Context-Action 유저 시나리오

## 목적 ^purpose

context-action 패턴과 scope-nesting 검증 도구를 실제 개발자가 어떤 순서로 사용하는지 공통 시나리오로 수집한다.

## 구성 ^overview

- **playbook 개발자**: template 위에 새 feature를 추가하고 scope-nesting 검증을 돌린다.
- **리팩터링 담당**: provider 순서 변경 전에 안전성을 사전 검증한다.
- **경량 모드 개발자**: qa-bridge 없이도 handler가 동작하게 optional consume을 설정한다.
- **테스트 작성자**: mock state를 provider override로 주입하여 격리 테스트를 만든다.
- **QA 엔지니어**: 비동기 초기화 타이밍 버그를 시뮬레이션으로 검출한다.

---

## 시나리오 1. template 위에 새 feature 추가하기

**사용자:** playbook feature 개발자
**목표:** canonical-review, incident-escalation에 이어 3번째 feature를 추가하고 구조 정합성 확보

### 순서

1. `template-flow`의 6단계 프로세스를 따라 domain draft, validation, handlers, views를 작성한다.
2. scope-nesting fixture에 새 feature의 pipe binding을 추가한다.

```typescript
const bindings = {
  "new-feature-validate": {
    scopeId: "handlers",
    scopeContracts: ["playbook-state"],
  },
  "new-feature-compute": {
    scopeId: "handlers",
    scopeContracts: ["playbook-state"],
  },
  "new-feature-log": {
    scopeId: "handlers",
    scopeContracts: [{ contractId: "logging-session", required: false }],
  },
};
```

3. `validateScopeNesting()`으로 계약 하향 성립 확인.
4. `validateMountFlow()`로 마운트 시점에 모든 계약 활성 확인.
5. `simulate()`로 handler graph의 happy path 확인.
6. 기존 두 feature와 패싯 트레이스 대칭 확인.

**완료 조건:** L1 valid + L1.5 valid + L3 complete + 패싯 트레이스가 기존 feature와 동일.

---

## 시나리오 2. provider 순서 변경 안전성 검증

**사용자:** 리팩터링 담당 개발자
**목표:** qa-bridge와 feature-context의 순서를 바꿔도 되는지 사전 확인

### 순서

1. `checkSwapSafety()`로 교환 대상 두 scope의 안전성 검사.

```typescript
import { checkSwapSafety } from "@qa-sdk/core";

const errors = checkSwapSafety(nesting, 0, 1); // qa-bridge ↔ feature-context
if (errors) {
  console.log("교환 불가:", errors.map(e => e.message));
} else {
  console.log("교환 안전");
}
```

2. 에러가 있으면 어떤 계약이 깨지는지 확인 — `contractId`와 `scopeId`로 영향 범위 파악.
3. 에러가 없으면 교환 후 `validateMountFlow()`로 pipe binding도 함께 검증.

**완료 조건:** `checkSwapSafety()` null → 교환 후 `validateMountFlow()` valid.

---

## 시나리오 3. qa-bridge 없이 경량 모드 운영

**사용자:** 경량 모드 또는 offline 환경 개발자
**목표:** logging 인프라 없이도 handler가 동작하게 만들기

### 순서

1. consumes에서 logging-session을 `required: false`로 선언.

```typescript
const nesting: ScopeNesting = {
  nestingId: "lightweight-playbook",
  scopes: [
    // qa-bridge 생략
    {
      scopeId: "feature-context",
      provides: [{ contractId: "playbook-state", type: "state" }],
      consumes: [{ contractId: "logging-session", type: "logging", required: false }],
    },
    {
      scopeId: "handlers",
      provides: [{ contractId: "submission-handlers", type: "adapter" }],
      consumes: [
        { contractId: "playbook-state", type: "state" },
        { contractId: "logging-session", type: "logging", required: false },
      ],
    },
    {
      scopeId: "view",
      provides: [],
      consumes: [
        { contractId: "playbook-state", type: "state" },
        { contractId: "submission-handlers", type: "adapter" },
      ],
    },
  ],
};
```

2. `validateScopeNesting()`이 `valid: true` + `optional-missing` warning 확인.
3. `validateMountFlow()`에서도 logging 관련 pipe binding을 optional로.

```typescript
"log-event": {
  scopeId: "handlers",
  scopeContracts: [{ contractId: "logging-session", required: false }],
},
```

4. 시뮬은 logging 유무와 무관하게 이벤트 체인 정상 동작 확인.

**완료 조건:** valid: true, optional-missing warning만 발생, simulate complete.

---

## 시나리오 4. 테스트에서 mock state override

**사용자:** 테스트 작성자
**목표:** 실제 feature-context 대신 mock state를 주입하여 handler를 격리 테스트

### 순서

1. 테스트용 scope에서 `playbook-state`를 `override: true`로 제공.

```typescript
const testNesting: ScopeNesting = {
  nestingId: "test-isolated",
  scopes: [
    {
      scopeId: "qa-bridge",
      provides: [{ contractId: "logging-session", type: "logging" }],
      consumes: [],
    },
    {
      scopeId: "feature-context",
      provides: [{ contractId: "playbook-state", type: "state" }],
      consumes: [],
    },
    {
      scopeId: "test-mock",
      provides: [{
        contractId: "playbook-state",
        type: "state",
        shape: "MockPlaybookState",
        override: true,
      }],
      consumes: [],
    },
    {
      scopeId: "handlers",
      provides: [{ contractId: "submission-handlers", type: "adapter" }],
      consumes: [{ contractId: "playbook-state", type: "state" }],
    },
  ],
};
```

2. `validateScopeNesting()`이 `valid: true`, `duplicate-provider` 없음 확인.
3. `resolveContracts()`로 handlers의 playbook-state provider가 `test-mock`인지 확인.

```typescript
const resolved = resolveContracts(testNesting, "handlers");
const state = resolved.find(r => r.contractId === "playbook-state")!;
assert(state.provider?.scopeId === "test-mock");
assert(state.overridden === true);
```

4. 테스트 끝나면 test-mock scope 제거 — 원래 nesting으로 복원.

**완료 조건:** overridden: true, provider가 test-mock, duplicate-provider warning 없음.

---

## 시나리오 5. 비동기 초기화 타이밍 버그 검출

**사용자:** QA 엔지니어
**목표:** persist load 전에 submit이 실행되는 타이밍 버그를 시뮬레이션으로 사전 검출

### 순서

1. playbook-state에 `readyAfter`를 선언.

```typescript
{
  scopeId: "feature-context",
  provides: [{
    contractId: "playbook-state",
    type: "state",
    readyAfter: "persist_load_complete",
  }],
  consumes: [],
}
```

2. handler graph에 persist loader pipe를 추가.
3. `simulate()`를 실행하여 이벤트 체인 타임라인 확보.
4. `validateContractTiming()`으로 교차 검증.

```typescript
const sim = simulate({ graph, initialEvent: { eventKey: "form_submit" } });
const timing = validateContractTiming(binding, sim);

if (!timing.valid) {
  const issue = timing.issues.find(i => i.code === "consume-before-ready");
  console.log(`타이밍 버그: ${issue.pipeId}가 ${issue.contractId} 준비 전에 소비`);
}
```

5. `readinessTimeline`에서 playbook-state의 준비 step과 submit handler의 실행 step 비교.

**완료 조건:** `consume-before-ready` error 검출 시 타이밍 버그 확인. persist loader를 submit 앞으로 재배치 후 timing valid.

---

## 시나리오 6. 역방향 위임 gap 검출

**사용자:** QA 엔지니어
**목표:** submit → persist 완료 사이에 view가 stale state를 렌더링하는 구간 검출

### 순서

1. submit handler에 `delegatesTo` 선언.

```typescript
"submit-handler": {
  scopeId: "handlers",
  scopeContracts: ["playbook-state"],
  delegatesTo: [{
    contractId: "playbook-state",
    completionEvent: "submit_persist_complete",
    tolerateStale: false,
  }],
},
```

2. `validateContractTiming()`으로 delegation gap 분석.

```typescript
const timing = validateContractTiming(binding, sim);
for (const gap of timing.delegationGaps) {
  console.log(
    `gap: ${gap.contractId} (step ${gap.gapStartStep}~${gap.gapEndStep})`,
    `stale consumers: ${gap.staleConsumers.join(", ")}`,
  );
}
```

3. stale consumer가 있으면:
   - `tolerateStale: true`로 완화하여 warning으로 허용 (UI에서 loading 표시)
   - 또는 view의 render를 `submit_persist_complete` 이벤트 이후로 지연

**완료 조건:** delegation-gap 검출 + stale consumer 식별. tolerateStale 설정 또는 구조 변경으로 해결.
