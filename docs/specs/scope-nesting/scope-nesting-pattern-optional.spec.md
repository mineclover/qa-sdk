---
def:
  id: scope-nesting-pattern-optional
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
---

# Optional Consume 패턴

## 목적 ^purpose

provider가 없어도 fallback으로 동작할 수 있는 선택적 계약 소비를 정의한다. fail-open 원칙에 부합.

## 정의 ^defines

- **ContractRef.required** — `false`이면 provider 없어도 warning만 (error 아님)

## 소비 ^consumes

- `ContractRef` / `validateScopeNesting()` (`@qa-sdk/core`)

## 검증 규칙

| 상황 | required | 결과 |
|------|----------|------|
| provider 없음 | `true` 또는 미설정 | `missing-provider` error |
| provider 없음 | `false` | `optional-missing` warning — valid 유지 |
| provider 있음 | 무관 | 정상 |

## 적용 예시

```typescript
{
  scopeId: "handlers",
  consumes: [
    { contractId: "playbook-state", type: "state" },           // 필수
    { contractId: "logging-session", type: "logging", required: false },  // 선택
  ],
}
```

## guard-inactive와의 조합

`isEncodable` false + `required: false` → `guard-inactive` warning + `optional-missing` warning. valid 유지.
