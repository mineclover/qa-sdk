---
def:
  id: service-event-adoption-plan
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
    - target: event-taxonomy-usecases-plan
      type: depends_on
    - target: service-ownership-spec
      type: depends_on
    - target: event-mapping-pack-plan
      type: depends_on
---

# Service Event Adoption — 설계 계획

## 목적 ^purpose

각 서비스가 어떤 event pack을 채택하고 어떤 custom event surface를 노출하는지 독립 관리하기 위한 `service event adoption` 모델을 정의한다. 목적은 서비스별 event taxonomy를 prefix ownership과 분리해 관리하면서도, registry materialization과 drift 검출의 기준점을 만드는 것이다.

## 구성 ^overview

- 서비스별 채택 pack 목록
- custom event surface
- 허용 category 범위
- adoption version pin
- service ownership과의 관계

## 정의 초안 ^defines

```ts
interface ServiceEventAdoption {
  serviceId: string;
  eventPacks: { packId: string; version: string }[];
  customEvents?: string[];
  allowedCategories?: string[];
}
```

### adoption이 답하는 질문

- 이 서비스는 어떤 event pack을 실제로 말하는가?
- 이 서비스는 어떤 custom event를 추가로 노출하는가?
- 이 서비스가 허용하는 event category 범위는 무엇인가?

### adoption이 소유하는 것

- service별 pack 채택
- service별 custom event
- service별 pack version pin

### adoption이 소유하지 않는 것

- 전역 event 의미
- 이벤트→prefix 해석 규칙 자체
- prefix ownership 자체

## service ownership과의 관계 ^constraint

- `ServiceOwnershipSpec`은 prefix 생산/소비를 소유한다.
- `ServiceEventAdoption`은 event pack 채택을 소유한다.
- 둘은 서로 대체하지 않는다.
- 다만 registry materialization과 drift 검출에서는 함께 읽어야 한다.

권장 정합성 규칙:

1. adoption된 pack이 내보내는 prefix는 ownership과 충돌하지 않아야 한다.
2. 서비스가 custom event를 선언하면 최소 하나의 prefix mapping 경로가 있어야 한다.
3. adoption은 pack version을 pin해야 한다.

## 권장 surface

- `GET /api/event-catalog/adoptions` ✅
- `GET /api/event-catalog/taxonomy/check` ✅
- `POST /api/event-catalog/taxonomy/assert` ✅
- `GET /api/event-catalog/adoptions/:serviceId` ✅
- `PUT /api/event-catalog/adoptions/:serviceId` ✅
- `DELETE /api/event-catalog/adoptions/:serviceId` ✅
- `POST /api/event-catalog/adoptions/migrate` ✅
- `GET /api/event-catalog/services/:serviceId/taxonomy` ✅
- `GET /api/event-catalog/services/:serviceId/taxonomy/check` ✅
- `POST /api/event-catalog/services/:serviceId/taxonomy/assert` ✅

## drift 포인트

- adoption에는 pack이 있는데 ownership에 해당 prefix가 전혀 없음
- ownership은 있는데 adoption에 대응하는 pack/custom event가 없음
- adoption version과 실제 materialized schema가 다름

## 시나리오 연결

- UC-3 기존 Pack을 새 서비스가 채택
- UC-5 서비스별 Custom Event 추가
- UC-6 Registry materialization
- UC-7 Drift 검출

## 평가

- 관리 용이성: 높음
- 확장성: 매우 높음
- 구현 난이도: 중간 이상
- 선행 조건: mapping pack이 first-class여야 함

## 현재 구현 상태

- adoption config read 가능
- adoption config write/remove 가능
- legacy string pack ref migration 가능
- adoption의 `packId + version` pin 지원
- adoption 기반 materialization 가능
- 서비스별 taxonomy read model 존재
- drift read model 존재
- diagnostics check surface 존재
- drift enforcement assert surface 존재
- catalog 단위 batch check/assert surface 존재
- 운영 스크립트 `pnpm gate:event-taxonomy` 제공
- demo catalog 기본 adoption seed 존재
- 새 adoption write path는 canonical `{ packId, version }[]`만 허용
- runtime seed는 legacy string pack ref를 materialize하지 않음
- 아직 없음:
  - ownership/adoption 정합성 gate
