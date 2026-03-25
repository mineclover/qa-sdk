---
def:
  id: convergence-advisors
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: convergence-layer-spec
      type: refines
    - target: convergence-comparators
      type: depends_on
---

# Convergence Layer - 추천과 수렴 사이클

## 목적 ^purpose

수렴 계층의 simplification advisor, boundary recommender, 수렴 사이클, 구현 매핑을 정리해 비교 결과가 실제 설계 판단으로 이어지는 경로를 설명한다.

## 추천 도구

- SimplificationAdvisor는 가짓수를 줄여도 의미가 유지되는 축/심볼 후보를 찾는다.
- BoundaryRecommender는 서비스나 문서 경계가 어긋난 지점을 찾아 재배치를 제안한다.
- 이 두 도구는 비교 결과 없이는 동작할 수 없으므로 `convergence-comparators`를 전제로 한다.

## 수렴 사이클

- 수렴은 발견 -> 제안 -> 인간 검토 -> 반영의 반복 사이클로 본다.
- DSS 패러다임 대응, 불변식, 구현 매핑은 이 사이클을 시스템에 붙이는 규칙이다.
- SchemaValidator가 prefix consumer로 동작하는 위치도 이 운영 관점에서 이해한다.
