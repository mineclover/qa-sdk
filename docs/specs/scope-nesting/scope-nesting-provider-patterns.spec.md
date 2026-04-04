---
def:
  id: scope-nesting-provider-patterns
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [frontend, structural]
  links:
    - target: scope-nesting-system
      type: refines
    - target: scope-nesting-guide
      type: refines
    - target: ms-concept-contract-descent
      type: implements
---

# Vite+ Playbook Provider 패턴

## 목적 ^purpose

scope-nesting의 provides/consumes 선언 위에서 동작하는 4가지 provider 패턴을 정의한다. 의존성 주입, 상위 provider 접근, 선택적 의존, provider 재정의를 계약 수준에서 검증 가능하게 만든다.

## 정의 ^defines

- **provider override** — 하위 scope가 상위 계약을 재정의
- **optional consume** — provider 없어도 fallback으로 동작
- **provider resolution** — 계약 해결 순서와 결과 조회
- **scope lifecycle** — scope 활성/비활성에 따른 계약 가용성

## 소비 ^consumes

- `ScopeContract` / `ScopeNesting` / `validateScopeNesting()` (`@qa-sdk/core`)
- `SimulationGuards` / `resolveGuards()` (`@qa-sdk/core`)
- contract descent 원칙 (`ms-concept-contract-descent`)

---

## 패턴 1: Provider Override

### 문제

하위 scope가 상위와 동일한 contractId를 제공하여 하위의 후손들이 상위 대신 하위 것을 사용하게 하고 싶다. 현재는 `duplicate-provider` warning으로 경고만 하고, 첫 등록(상위)이 canonical provider로 유지된다.

### 설계

ContractRef에 `override` 플래그를 추가. `override: true`이면 상위 provider를 의도적으로 대체.

```typescript
interface ContractRef {
  contractId: string;
  type: "state" | "logging" | "persist" | "adapter" | "custom";
  shape?: string;
  /** 상위 provider를 의도적으로 재정의 (기본: false) */
  override?: boolean;
}
```

### 검증 규칙

| 상황 | override | 결과 |
|------|----------|------|
| 상위에 동일 계약 있음 | `true` | 정상 — 하위의 후손은 하위 provider 사용 |
| 상위에 동일 계약 있음 | `false` 또는 미설정 | `duplicate-provider` warning (현재 동작 유지) |
| 상위에 동일 계약 없음 | `true` | `override-no-parent` warning — override 선언했지만 대체 대상 없음 |

### 적용 예시

feature-context가 테스트용 mock state를 제공하여 상위의 실제 state를 대체:

```typescript
{
  scopeId: "test-context",
  provides: [
    { contractId: "playbook-state", type: "state", shape: "MockState", override: true },
  ],
  consumes: [{ contractId: "logging-session", type: "logging" }],
}
```

### DescentPath 영향

override 시 descentPath의 `providedBy`가 하위 scope로 교체됨. 상위 provider는 override된 depth 이하에서 보이지 않음.

---

## 패턴 2: Optional Consume

### 문제

qa-bridge가 없어도 handler가 logging 없이 동작할 수 있어야 한다 (fail-open). 현재는 consumes에 있으면 반드시 provider가 있어야 하고 없으면 `missing-provider` error.

### 설계

ContractRef에 `required` 필드를 추가. `required: false`이면 provider 없어도 error가 아닌 warning.

```typescript
interface ContractRef {
  contractId: string;
  type: "state" | "logging" | "persist" | "adapter" | "custom";
  shape?: string;
  override?: boolean;
  /** 필수 여부 (기본: true). false이면 provider 없어도 warning만 */
  required?: boolean;
}
```

### 검증 규칙

| 상황 | required | 결과 |
|------|----------|------|
| provider 없음 | `true` 또는 미설정 | `missing-provider` error (현재 동작 유지) |
| provider 없음 | `false` | `optional-missing` warning — 동작은 가능하지만 기능 제한 |
| provider 있음 | 무관 | 정상 |

### 적용 예시

handler가 logging을 선택적으로 소비:

```typescript
{
  scopeId: "handlers",
  provides: [{ contractId: "submission-handlers", type: "adapter" }],
  consumes: [
    { contractId: "playbook-state", type: "state" },           // 필수
    { contractId: "logging-session", type: "logging", required: false },  // 선택
  ],
}
```

### NestingValidation 영향

`valid`는 error 기준이므로 optional-missing은 valid에 영향 없음. issues에서 warning으로 보고.

---

## 패턴 3: Provider Resolution

### 문제

시뮬레이션이나 테스트에서 "특정 계약이 어느 scope에서 해결되는가"를 조회하고 싶다. 현재 descentPaths가 이를 부분적으로 제공하지만, 특정 scope 관점에서 "내가 소비하는 계약의 provider는 누구인가"를 직접 조회하는 API가 없다.

### 설계

```typescript
interface ResolvedContract {
  contractId: string;
  /** provider가 없으면 null (optional consume 시) */
  provider: { scopeId: string; depth: number } | null;
  consumer: { scopeId: string; depth: number };
  /** override로 대체되었는가 */
  overridden: boolean;
  /** optional이고 provider 없는가 */
  optional: boolean;
}

/** 특정 scope 관점에서 소비하는 계약의 provider를 조회 */
function resolveContracts(
  nesting: ScopeNesting,
  scopeId: string,
  guards?: SimulationGuards,
): ResolvedContract[];
```

### 사용처

- 테스트에서 "handler의 logging-session provider가 qa-bridge인지" 단언
- 시뮬레이션에서 scope간 계약 의존 그래프 시각화
- override 적용 후 실제 해결 경로 확인

---

## 패턴 4: Scope Lifecycle

### 문제

L0 guard의 `isEncodable`이 런타임에 변경되면 scope가 동적으로 활성/비활성될 수 있다. 현재 검증은 정적 스냅샷 기반이라 "scope가 비활성화되면 하위에 어떤 영향이 있는가"를 사전에 분석할 수 없다.

### 설계

```typescript
/** scope 비활성화 시 영향 분석 */
function analyzeDeactivation(
  nesting: ScopeNesting,
  scopeId: string,
): DeactivationImpact;

interface DeactivationImpact {
  /** 비활성화되는 scope */
  deactivated: string;
  /** 비활성화로 인해 계약이 끊기는 하위 scope */
  affected: Array<{
    scopeId: string;
    lostContracts: string[];
  }>;
  /** 영향 없는 하위 scope (다른 provider에서 해결됨 또는 optional) */
  unaffected: string[];
}
```

### 적용 예시

qa-bridge가 비활성화되면:

```
analyzeDeactivation(nesting, "qa-bridge")
→ {
    deactivated: "qa-bridge",
    affected: [
      { scopeId: "feature-context", lostContracts: ["logging-session"] },
      { scopeId: "handlers", lostContracts: ["logging-session"] },
    ],
    unaffected: ["view"],  // view는 logging-session을 소비하지 않음
  }
```

---

## 구현 우선순위

| 순서 | 패턴 | 이유 |
|------|------|------|
| 순서 | 패턴 | 상태 |
|------|------|------|
| 1 | optional consume | 구현 완료 (`ContractRef.required`) |
| 2 | provider override | 구현 완료 (`ContractRef.override`) |
| 3 | provider resolution | 구현 완료 (`resolveContracts()`) |
| 4 | scope lifecycle (`analyzeDeactivation`) | 미구현 — 패턴 1~3 안정화 후 진행 예정 |
