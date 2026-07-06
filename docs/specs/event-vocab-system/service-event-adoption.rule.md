---
def:
  id: service-event-adoption-rule
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: event-catalog
  tags: [observability]
  links:
    - target: service-event-adoption-spec
      type: refines
    - target: event-taxonomy-role-contract
      type: depends_on
    - target: event-intent-definition-rule
      type: depends_on
sources:
  - packages/registry-service/src/modules/events/event-catalog.service.ts
  - packages/registry-service/src/modules/events/event-catalog.controller.ts
  - packages/registry-service/src/modules/events/event.controller.test.ts
  - scripts/registry-event-taxonomy-gate.sh
---

# Service Event Adoption — 소비 규칙

## 목적 ^purpose

service event adoption을 수정하거나 운영 게이트에서 소비할 때 확인해야 하는 입력 규칙과 판정 순서를 정의한다.

## 체크리스트

### 1. adoption 입력 형식

- `eventPacks`는 반드시 `{ packId, version }[]`
- string pack ref 금지
- `allowedCategories`는 선택 항목

### 2. pack 참조

- `packId`는 registry에 존재해야 한다
- `version`은 현재 pack version과 일치해야 한다

### 3. ownership 정합성

- self-owned pack은 ownership consistency gate 대상에서 제외
- 외부 pack 채택 시에만 `adopted-prefixes-without-ownership` 검사

### 4. catalog gate 대상

- `adoption`을 선언한 서비스
- active pack owner 서비스

이 두 집합의 합집합만 catalog gate 대상으로 본다.

### 5. logger fallback event key

- `svc_log.<level>`은 logger bridge의 진단 fallback이며 adoption-clean event key로 자동 인정하지 않는다.
- 서비스가 `svc_log.<level>`을 운영 taxonomy 대상으로 삼으려면 해당 key를 포함한 mapping pack을 만들고 service adoption에 pin해야 한다.
- gate-clean domain/production event는 fallback에 의존하지 말고 명시 `eventKey`를 사용한다.

### 6. requester-aware data-effect event

- backend event key는 raw DB mutation만으로 정하지 않는다.
- request path, requester, frontend behavior unit, data subject/effect, persistence outcome을 함께 보고 event intent를 정한다.
- alerting에 쓰이는 event는 `requester_type`, `requester_id` 또는 그에 준하는 actor context를 가져야 한다.
- frontend event는 behavior unit을, backend event는 data effect와 persistence outcome을 소유한다.

## 운영 순서

1. `GET /api/event-catalog/adoptions` 또는 `GET /api/event-catalog/adoptions/:serviceId`로 현재 adoption 확인
2. 필요하면 `PUT /api/event-catalog/adoptions/:serviceId`로 canonical adoption 갱신
3. `GET /api/event-catalog/services/:serviceId/taxonomy/check`로 서비스 drift 확인
4. `POST /api/event-catalog/services/:serviceId/taxonomy/assert` 또는 `pnpm gate:event-taxonomy`로 게이트 실행

## 실패 해석

| code | 의미 | 우선 조치 |
|---|---|---|
| `adoption-missing` | 채택 선언 없음 | adoption 대상 서비스인지 먼저 확인 |
| `missing-pack-ids` | 존재하지 않는 pack 참조 | packId 수정 |
| `stale-pack-versions` | version pin 불일치 | version 갱신 |
| `adopted-prefixes-without-ownership` | 외부 pack과 ownership 불일치 | ownership 또는 adoption 재검토 |
| `records-without-pack-metadata` | materialized record 메타데이터 누락 | seed/materialization 점검 |
| `prefixes-without-ownership` | materialized prefix와 ownership 불일치 | ownership 점검 |
