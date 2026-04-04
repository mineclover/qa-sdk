---
def:
  id: scope-nesting-pattern-lifecycle
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [structural]
  links:
    - target: scope-nesting-provider-patterns
      type: refines
    - target: scope-nesting-guide
      type: depends_on
---

# Scope Lifecycle 패턴 (미구현)

## 목적 ^purpose

scope 비활성화 시 하위에 어떤 영향이 있는지 사전 분석하는 API를 정의한다. L0 guard의 동적 변화에 대응.

## 정의 ^defines

- **analyzeDeactivation()** — scope 비활성화 영향 분석 함수
- **DeactivationImpact** — 영향받는 scope + 끊기는 계약 + 무영향 scope

## 소비 ^consumes

- `ScopeNesting` / `SimulationGuards` (`@qa-sdk/core`)

## 설계

```typescript
function analyzeDeactivation(
  nesting: ScopeNesting,
  scopeId: string,
): DeactivationImpact;

interface DeactivationImpact {
  deactivated: string;
  affected: Array<{ scopeId: string; lostContracts: string[] }>;
  unaffected: string[];
}
```

## 적용 예시

```
analyzeDeactivation(nesting, "qa-bridge")
→ {
    deactivated: "qa-bridge",
    affected: [
      { scopeId: "feature-context", lostContracts: ["logging-session"] },
      { scopeId: "handlers", lostContracts: ["logging-session"] },
    ],
    unaffected: ["view"],
  }
```

## 구현 상태

미구현. 패턴 1~3 안정화 후 진행 예정.
