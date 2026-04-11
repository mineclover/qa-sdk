---
def:
  id: event-taxonomy-roadmap-plan
  level: module
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  svc: event-catalog
  tags: [cross-scope, structural, observability, entry-point]
  links:
    - target: event-taxonomy-layering-plan
      type: refines
    - target: event-seed-materialization-phase0-plan
      type: contains
    - target: event-taxonomy-usecases-plan
      type: depends_on
    - target: event-taxonomy-rollout-todo
      type: depends_on
    - target: service-ownership-spec
      type: depends_on
---

# Event Taxonomy Roadmap — 구현 진행 상태

## 목적 ^purpose

event taxonomy 3층 분리 구조를 실제 시스템으로 이행하기 위한 로드맵을 정리한다. 가장 먼저 `seed-events.ts`의 `serviceId` 하드코딩을 제거하여 현재 구조적 리스크를 낮추고, 이후 mapping pack과 service adoption을 단계적으로 도입하는 것이 목표다.

## 핵심 원칙 ^overview

- **위험 제거를 먼저**: 구조 전체를 완성하기 전에 명백한 잘못된 seed 결과부터 제거한다.
- **임시 해법과 최종 구조를 분리**: hardcoding 제거는 즉시 적용, service adoption은 후속 도입.
- **기존 운영 surface를 깨지 않는다**: registry-event surface는 유지하고 내부 seed 규칙만 점진 교체한다.

## Phase 0–3 — 완료 요약

| Phase | 목표 | 핵심 결과 |
|---|---|---|
| Phase 0 | 하드코딩 제거 | `serviceId: "shopping-web"` 제거, `_core`/`_mapping` synthetic bucket 도입, candidate 힌트 기반 귀속 |
| Phase 1 | Mapping Pack First-Class화 | `EventMappingPack` 타입/registry surface 도입, pack 단위 조회 구조 완성 |
| Phase 2 | Service Event Adoption 도입 | `ServiceEventAdoption` 모델, `eventPacks`/`allowedCategories` 정의, ownership-adoption 정합성 규칙 |
| Phase 3 | Registry Materialization 교체 | core vocabulary + pack + adoption 3층 조합 materialize, 서비스별 event schema 생성 |

> 상세: Phase 0 임시 fallback 설계는 `event-seed-materialization-phase0-plan` 참조.

## Phase 4 — Drift Gate + Versioning (진행 중)

### 목표

pack/adoption/materialization 간 drift와 pack version 전환을 관리 가능하게 만든다.

### 작업

- drift diagnostics/check surface 구현
- drift enforcement/assert surface 구현
- pack version pin 구현
- override/local pack 정책 정의

### 남은 완료 조건

- UC-3/6/7 adoption path 실 서비스 온보딩 검증 후 spec 승격
- UC-4/8 override/migration 정책의 실 적용 사례 검증 후 spec 승격

## 우선순위

1. Phase 0 — 하드코딩 제거
2. Phase 1 — Mapping Pack First-Class화
3. Phase 2 — Service Event Adoption
4. Phase 3 — Registry Materialization 교체
5. Phase 4 — Drift Gate + Versioning

## 현재 상태 요약

- `_core` synthetic bucket 기반 vocabulary seed 유지
- adoption 미존재 시 mapping materialization을 생략하도록 cutover 완료
- `EventMappingPack` registry 및 조회 surface 구현
- `service event adoption` config read/write/remove surface 구현
- demo catalog 기본 `event-adoption` seed 구현
- adoption의 `packId + version` pin 구현
- 서비스별 event taxonomy read model + drift diagnostics/check surface 구현
- service taxonomy drift를 409로 실패시키는 assert surface 구현
- adopted pack prefix와 service ownership 정합성 gate 구현
- write/runtime path는 canonical pack ref만 허용
- 운영 게이트 스크립트 `pnpm gate:event-taxonomy` 제공
- 시나리오 안정화 문서화 완료 (`event-taxonomy-usecases-plan` 참조)
- override/local pack 정책 초안 작성 완료 (UC-4, plan 단계)
- pack version pin/migration 정책 초안 작성 완료 (UC-8, plan 단계)

## 관련 문서

- `event-taxonomy-layering-plan`
- `event-taxonomy-usecases-plan`
- `event-taxonomy-rollout-todo`
- `service-ownership-spec`
