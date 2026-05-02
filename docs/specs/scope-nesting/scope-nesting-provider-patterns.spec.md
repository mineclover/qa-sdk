---
def:
  id: scope-nesting-provider-patterns
  tier: system
  scope: feature
  aspect: nesting_func
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [structural, cross-scope]
  links:
    - target: scope-nesting-pattern-override
      type: contains
    - target: scope-nesting-pattern-optional
      type: contains
    - target: scope-nesting-pattern-resolution
      type: contains
    - target: scope-nesting-pattern-lifecycle
      type: depends_on
    - target: scope-nesting-guide
      type: refs
    - target: ms-concept-contract-descent
      type: implements
---

# Provider 패턴

## 목적 ^purpose

scope-nesting의 provides/consumes 위에서 동작하는 4가지 provider 패턴의 개요.

## 방법 ^method

**pattern-override**가 상위 계약 재정의를,
**pattern-optional**이 선택적 소비를,
**pattern-resolution**이 해결 결과 조회를,
**pattern-lifecycle**이 비활성화 영향 분석을 담당한다.

## 위임 ^delegates

- **pattern-override** → ContractRef.override 플래그 + 검증 규칙 (구현 완료)
- **pattern-optional** → ContractRef.required 플래그 + 검증 규칙 (구현 완료)
- **pattern-resolution** → ResolvedContract + resolveContracts() API (구현 완료)
- **pattern-lifecycle** → analyzeDeactivation() 설계 (미구현, draft)
