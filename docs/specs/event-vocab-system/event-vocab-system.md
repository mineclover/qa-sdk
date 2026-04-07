---
def:
  id: event-vocab-system
  level: module
  address: def_document:v2:342023
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
    - target: event-taxonomy-layering-plan
      type: contains
    - target: event-taxonomy-roadmap-plan
      type: contains
    - target: event-mapping-pack-plan
      type: contains
    - target: service-event-adoption-plan
      type: contains
    - target: event-taxonomy-usecases-plan
      type: contains
    - target: event-taxonomy-rollout-todo
      type: contains
    - target: storage-system
      type: depends_on
    - target: registry-events-spec
      type: depends_on
---

## 목적 ^purpose

이벤트 정의의 핵심 패턴, 그래프 힌트, 페이로드 설계 가이드.

## 구성 ^overview

- `event-core-pattern`: 전역 Core Event vocabulary. 서비스 공통 실행 패턴을 정의한다.
- `graph-hint-spec`: Core Event가 실행 그래프에서 어떤 역할을 하는지 정적 힌트를 제공한다.
- `payload-guide`: Core Event별 권장 payload 필드 가이드.
- `event-taxonomy-layering-plan`: global vocabulary / mapping pack / service adoption 3층 분리 설계 초안.
- `event-taxonomy-roadmap-plan`: `seed-events` 하드코딩 제거를 최우선으로 둔 이행 로드맵.
- `event-mapping-pack-plan`: mapping pack을 first-class로 다루는 설계 초안.
- `service-event-adoption-plan`: 서비스별 pack 채택과 custom event surface를 관리하는 설계 초안.
- `event-taxonomy-usecases-plan`: 관리 용이성과 확장성을 검증하는 대표 사용 시나리오.
- `event-taxonomy-rollout-todo`: pack first-class화, service adoption 도입, seed-events 재설계의 실행 체크리스트.
