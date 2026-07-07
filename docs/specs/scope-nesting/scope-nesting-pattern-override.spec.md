---
def:
  tier: component
  id: scope-nesting-pattern-override
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [structural]
  links:
    - target: scope-nesting-provider-patterns
      type: refines
    - target: scope-nesting-guide
      type: depends_on
sources:
  - packages/core/src/scope-nesting.ts
  - packages/core/src/scope-nesting.test.ts
---

# Provider Override 패턴

## 목적 ^purpose

하위 scope가 상위 scope의 동일 계약을 의도적으로 재정의하는 패턴을 정의한다. 테스트에서 mock 주입, 환경별 구현 교체에 사용.

## 정의 ^defines

- **ContractRef.override** — `true`이면 상위 provider를 대체

## 소비 ^consumes

- `ContractRef` / `validateScopeNesting()` (`@qa-sdk/core`)

## 검증 규칙

| 상황 | override | 결과 |
|------|----------|------|
| 상위에 동일 계약 있음 | `true` | 정상 — 하위의 후손은 하위 provider 사용 |
| 상위에 동일 계약 있음 | `false` 또는 미설정 | `duplicate-provider` warning (첫 등록 유지) |
| 상위에 동일 계약 없음 | `true` | `override-no-parent` warning |

## 적용 예시

```typescript
{
  scopeId: "test-mock",
  provides: [
    { contractId: "playbook-state", type: "state", shape: "MockState", override: true },
  ],
  consumes: [],
}
```

## DescentPath 영향

override 시 `descentPath.providedBy`가 하위 scope로 교체. 상위 provider는 override된 depth 이하에서 보이지 않음.
