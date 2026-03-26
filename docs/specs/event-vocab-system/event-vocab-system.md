---
def:
  id: event-vocab-system
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: event-catalog
  tags: [structural, entry-point]
  links:
    - target: graph-hint-spec
      type: contains
    - target: event-core-pattern
      type: contains
    - target: payload-guide
      type: contains
    - target: storage-system
      type: depends_on
---

## 목적 ^purpose

이벤트 정의의 핵심 패턴, 그래프 힌트, 페이로드 설계 가이드.

## 구성 ^overview

- `graph-hint-spec`: Core Event가 실행 그래프에서 어떤 역할을 하는지 정적 힌트를 제공한다.
- `event-core-pattern`: QA Scenario DSL과 Runtime Matching Engine이 공통으로 참조할 수 있는 최소 실행 패턴 집합.
- `payload-guide`: Core Event별 권장 payload 필드 가이드.
