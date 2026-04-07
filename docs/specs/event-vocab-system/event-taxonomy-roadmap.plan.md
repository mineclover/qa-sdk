---
def:
  id: event-taxonomy-roadmap-plan
  level: leaf
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

## Phase 0 — 하드코딩 제거 (완료)

### 목표

`seed-events.ts`가 전역 mapping을 모두 `shopping-web`로 귀속시키는 문제를 제거한다.

### 개선안

세부 알고리즘은 `event-seed-materialization-phase0-plan`을 따른다.

핵심은:

1. core event는 `_core`
2. mapping event는 `_mapping`
3. ownership overlap은 `candidate` 힌트로만 계산
4. 실제 서비스 귀속은 adoption 도입 전까지 하지 않음

### 이유

- 지금 당장 잘못된 서비스 귀속을 막을 수 있다.
- `service adoption` 도입 전에도 registry 결과의 명백한 왜곡을 줄인다.
- 기존 스키마를 바꾸지 않고도 안전한 중간 상태를 만들 수 있다.

### 한계

- 이것은 **synthetic bucket 기반 임시 materialization**이다.
- `_mapping`은 실제 서비스가 아니다.
- 따라서 최종 authoritative model은 아니다.

## Phase 1 — Mapping Pack First-Class화 (완료)

### 목표

`prefix-mapping.ts`의 전역 side-effect registry를 pack 단위 구조로 승격한다.

### 작업

- `EventMappingPack` 타입 도입
- pack registry surface 도입
- 기존 mapping 묶음을 shop/harness/decision/infra/cli/... pack으로 명시 분리

### 완료 조건

- pack 단위 조회 가능
- 각 mapping이 어떤 pack에 속하는지 명시 가능

## Phase 2 — Service Event Adoption 도입 (완료)

### 목표

서비스가 어떤 pack과 custom event surface를 채택하는지 명시하는 layer를 만든다.

### 작업

- `ServiceEventAdoption` 모델 도입
- 서비스별 `eventPacks`, `customEvents`, `allowedCategories` 정의
- ownership과 adoption의 정합성 규칙 초안 작성

### 완료 조건

- 서비스별 event taxonomy를 직접 조회 가능
- `ownedPrefixes`와 분리된 event adoption surface 존재

## Phase 3 — Registry Materialization 교체 (완료)

### 목표

registry seed가 `core vocabulary + mapping pack + service adoption` 3층을 조합해 event schema를 materialize하도록 재구성한다.

### 작업

- `seed-events.ts` 재설계
- service별 event schema 생성 규칙 명시
- 미채택 pack/custom event에 대한 처리 규칙 정의

### 완료 조건

- `shopping-web` 하드코딩 완전 제거
- 서비스별 event schema가 adoption 기반으로 생성

## Phase 4 — Drift Gate + Versioning (진행 중)

### 목표

pack/adoption/materialization 간 drift와 pack version 전환을 관리 가능하게 만든다.

### 작업

- drift diagnostics/check surface 구현
- pack version pin 구현
- adoption migration 규칙 구체화
- override/local pack 정책 정의

### 남은 완료 조건

- drift gate enforcement 정의
- `_mapping` fallback 제거 조건 확정
- UC-7 Drift 검출 안정화
- UC-8 Pack 버전 전환 안정화

## 우선순위

1. Phase 0 — 하드코딩 제거
2. Phase 1 — Mapping Pack First-Class화
3. Phase 2 — Service Event Adoption
4. Phase 3 — Registry Materialization 교체
5. Phase 4 — Drift Gate + Versioning

## 현재 상태 요약

- `_core` / `_mapping` synthetic bucket 기반 seed fallback 구현
- `EventMappingPack` registry 및 조회 surface 구현
- `service event adoption` config read/write/remove surface 구현
- demo catalog 기본 `event-adoption` seed 구현
- adoption의 `packId + version` pin 구현
- 서비스별 event taxonomy read model + drift diagnostics/check surface 구현
- 아직 미구현:
  - drift gate의 enforcement
  - `_mapping` fallback 제거
  - adoption migration rule 명문화

## 관련 문서

- `event-taxonomy-layering-plan`
- `event-taxonomy-usecases-plan`
- `event-taxonomy-rollout-todo`
- `service-ownership-spec`
