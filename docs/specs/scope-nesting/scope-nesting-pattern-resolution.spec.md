---
def:
  tier: component
  id: scope-nesting-pattern-resolution
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

# Provider Resolution 패턴

## 목적 ^purpose

특정 scope 관점에서 소비하는 계약의 provider를 조회하는 API를 정의한다. override/optional/guard를 반영한 실제 해결 결과를 반환.

## 정의 ^defines

- **ResolvedContract** — 해결된 계약 정보 (provider, overridden, optional)
- **resolveContracts()** — scope 관점 계약 해결 함수

## 소비 ^consumes

- `ScopeNesting` / `SimulationGuards` (`@qa-sdk/core`)

## API

```typescript
interface ResolvedContract {
  contractId: string;
  provider: { scopeId: string; depth: number } | null;
  consumer: { scopeId: string; depth: number };
  overridden: boolean;
  optional: boolean;
}

function resolveContracts(
  nesting: ScopeNesting,
  scopeId: string,
  guards?: SimulationGuards,
): ResolvedContract[];
```

## 사용처

- 테스트에서 "handler의 logging-session provider가 qa-bridge인지" 단언
- override 적용 후 실제 해결 경로 확인
- scope간 계약 의존 그래프 시각화
