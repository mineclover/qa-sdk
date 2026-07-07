---
def:
  tier: component
  id: scope-nesting-validation-rules
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [structural, testing]
  links:
    - target: scope-nesting-system
      type: refines
    - target: scope-nesting-guide
      type: refines
sources:
  - packages/core/src/scope-nesting.ts
  - packages/core/src/scope-nesting.test.ts
---

# Scope Nesting 검증 규칙

## 목적 ^purpose

`validateScopeNesting()`이 발행하는 8종 검증 코드의 의미, severity, 해결 방법을 고정한다.

## 정의 ^defines

- **NestingIssueCode 8종** — 검증 규칙 집합

## 소비 ^consumes

- `NestingIssue` / `NestingIssueCode` (`@qa-sdk/core`)
- `SimulationGuards` — L0 guard 주입 (`@qa-sdk/core`)

## 검증 규칙 테이블

| 코드 | severity | 의미 | 해결 |
|------|----------|------|------|
| `missing-provider` | error | 소비하는 계약의 제공자가 상위에 없음 (순서 위반 포함) | scope 순서 조정 또는 provider 추가 |
| `self-consume` | error | 자기가 제공한 계약을 자기가 소비 | consumes에서 제거 |
| `duplicate-provider` | warning | 동일 계약을 복수 scope가 제공 (첫 등록이 canonical) | `override: true`로 의도 명시 또는 중복 제거 |
| `unused-contract` | warning | 제공하지만 하위에서 소비하지 않음 | 불필요하면 provides에서 제거 |
| `empty-scope` | warning | provides도 consumes도 없는 scope | scope 제거 또는 계약 추가 |
| `guard-inactive` | warning | L0 guard에 의해 계약 비활성 (encode 불가) | gate 상태 확인 또는 guard 조건 완화 |
| `optional-missing` | warning | optional consume(required: false)의 provider 부재 | fallback 동작 확인, 필요 시 provider 추가 |
| `override-no-parent` | warning | override 선언했지만 상위에 대체 대상 없음 | override 플래그 제거 또는 상위에 provider 추가 |

## severity 기준

- **error** → `valid: false`. 구조적 정합성 위반. 반드시 수정.
- **warning** → `valid: true`. 의도적일 수 있지만 검토 필요.

## L0 Guard 정책

```typescript
import { validateScopeNesting, type SimulationGuards } from "@qa-sdk/core";

const guards: SimulationGuards = {
  isEncodable: (contractId) => gateEngine.isActive(contractId),
  // gateResult, harnessState는 미주입 시 기본 허용 (fail-open)
};

const result = validateScopeNesting(nesting, guards);
```

- `isEncodable` false → 해당 계약이 `guard-inactive` warning + provider로 미등록
- 하위가 해당 계약을 소비하면 `missing-provider` error (required) 또는 `optional-missing` warning (optional)
- guard 미주입 시 모두 허용 (fail-open 원칙)
