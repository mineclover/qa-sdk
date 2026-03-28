---
def:
  id: convergence-comparators
  address: def_document:v1:537
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [tier-system]
  links:
    - target: spec-core-types
      type: depends_on
    - target: convergence-layer-spec
      type: refines
---

# Convergence Layer - 비교와 인과 발견

## 목적 ^purpose

수렴 계층의 SymbolComparator, DecisionComparator, CausalDiscovery가 어떤 관측 입력을 받아 비교/발견을 수행하는지 정리한다.

## 비교 계층

- 수렴 계층은 관측 데이터 인터페이스 위에서 심볼과 결정을 비교해 drift를 찾는다.
- SymbolComparator는 이름/구조의 차이를, DecisionComparator는 선택 경로와 근거의 차이를 다룬다.
- CausalDiscovery는 비교 결과를 인과 후보로 승격해 후속 설계 판단에 연결한다.

## 입력 계약

- 비교 도구는 모두 `spec-core-types`가 정의한 symbol/prefix 구조를 공통 입력으로 쓴다.
- 이 문서는 관측과 비교 알고리즘의 정체성을 다루고, 추천/사이클 운영은 `convergence-advisors`로 넘긴다.
