---
def:
  id: event-taxonomy-rollout-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  svc: event-catalog
  tags: [cross-scope, structural, observability]
  links:
    - target: event-taxonomy-layering-plan
      type: refines
    - target: event-taxonomy-roadmap-plan
      type: depends_on
    - target: event-seed-materialization-phase0-plan
      type: depends_on
    - target: event-mapping-pack-plan
      type: depends_on
    - target: service-event-adoption-plan
      type: depends_on
    - target: event-vocab-system
      type: refines
---

# Event Taxonomy Rollout — 실행 TODO

## 목적 ^purpose

event taxonomy 3층 분리 설계를 실제 구조와 도구에 반영하기 위한 실행 항목을 추적한다.

## 구현 항목

### Phase 0 — 하드코딩 제거

- [ ] `seed-events.ts`의 `serviceId: "shopping-web"` 하드코딩 제거
- [ ] mapping 기반 이벤트를 `_mapping` synthetic bucket으로 seed하는 규칙 적용
- [ ] config store의 서비스 목록을 읽어 candidate service 힌트를 description에 기록
- [ ] `_core`, `_mapping`이 synthetic bucket임을 registry surface 문서에 반영

### Phase 1 — Mapping Pack

- [ ] `event-core-pattern`을 실제 구현 기준(9 categories, 82 events)으로 유지 검증하는 규칙 추가
- [ ] mapping pack 개념을 first-class 타입/문서로 도입 (`packId`, `owner`, `mappings`)
- [ ] `prefix-mapping.ts`의 전역 side-effect registry를 pack 단위 조회 구조로 분리

### Phase 2 — Service Adoption

- [ ] `service event adoption` 모델 도입 (`serviceId -> eventPacks/customEvents/allowedCategories`)
- [ ] registry-service에 pack/adoption 조회 surface 추가 여부 결정
- [ ] `service ownership`와 `service event adoption`의 정합성 검증 규칙 정의

### Phase 3 — Materialization

- [ ] event schema seed가 core vocabulary / mapping pack / service adoption 3층을 조합해 materialize하도록 재설계

## 시나리오 안정화

- [ ] UC-1/2/5를 1차 안정화 시나리오로 고정하고, 각 시나리오의 변경 층과 blast radius를 문서화
- [ ] UC-3/6/7을 adoption/materialization 시나리오로 묶고, registry seed 경로 재설계 후 안정화
- [ ] UC-4 override 규칙 초안 작성 (global pack 오염 금지, local override 범위 제한)
- [ ] UC-8 pack version pin / migration 규칙 초안 작성
- [ ] 시나리오별 drift 검출 포인트(ownership / pack / adoption / seed 결과)를 gate 체크리스트로 정리
