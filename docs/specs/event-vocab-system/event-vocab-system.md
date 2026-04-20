---
def:
  id: event-vocab-system
  tier: system
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
      type: depends_on
    - target: event-taxonomy-role-contract
      type: contains
    - target: event-taxonomy-roadmap-plan
      type: depends_on
    - target: event-mapping-pack-spec
      type: contains
    - target: service-event-adoption-spec
      type: contains
    - target: service-event-adoption-rule
      type: contains
    - target: event-taxonomy-contracts-test
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
      type: contains
---

## 목적 ^purpose

이벤트 정의의 핵심 패턴, 그래프 힌트, 페이로드 설계 가이드.

## 구성 ^overview

- `event-core-pattern`: 전역 Core Event vocabulary. 서비스 공통 실행 패턴을 정의한다.
- `graph-hint-spec`: Core Event가 실행 그래프에서 어떤 역할을 하는지 정적 힌트를 제공한다.
- `payload-guide`: Core Event별 권장 payload 필드 가이드.
- `event-taxonomy-layering-plan`: global vocabulary / mapping pack / service adoption 3층 분리 설계 배경.
- `event-taxonomy-role-contract`: 각 레이어가 무엇을 소유하고 무엇을 소유하지 않는지 고정하는 역할 계약.
- `event-taxonomy-roadmap-plan`: 현재 구조에 도달한 이행 단계와 남은 정리 항목.
- `event-mapping-pack-spec`: mapping pack의 현재 계약.
- `service-event-adoption-spec`: 서비스별 pack 채택의 현재 계약.
- `service-event-adoption-rule`: service adoption을 소비할 때 확인할 운영 규칙.
- `event-taxonomy-contracts-test`: 현재 계약을 유지하는 validation 시나리오.
- `event-mapping-pack-plan`: mapping pack의 역사적 설계 메모.
- `service-event-adoption-plan`: service adoption의 초기 설계 배경 메모.
- `event-taxonomy-usecases-plan`: 관리 용이성과 확장성을 검증하는 대표 사용 시나리오.
- `event-taxonomy-rollout-todo`: pack first-class화, service adoption 도입, seed-events 재설계의 실행 체크리스트.
