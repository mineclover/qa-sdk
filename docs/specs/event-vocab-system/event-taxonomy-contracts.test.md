---
def:
  id: event-taxonomy-contracts-test
  level: leaf
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: event-catalog
  tags: [testing, observability]
  links:
    - target: event-taxonomy-role-contract
      type: refines
    - target: event-mapping-pack-spec
      type: depends_on
    - target: service-event-adoption-spec
      type: depends_on
  source: packages/registry-service/src/core/seed-events.test.ts
---

# Event Taxonomy Contracts — 검증 기준

## 목적 ^purpose

event taxonomy의 현재 계약이 registry surface와 seed/materialization 경로에서 유지되는지 검증한다.

소스:
- `packages/registry-service/src/core/seed-events.test.ts`
- `packages/registry-service/src/modules/events/event.controller.test.ts`

## 전제 ^preconditions

- `event-catalog` pack registry 사용 가능
- `registry-service` Nest test app 또는 in-memory stores 사용 가능
- canonical adoption 모델: `{ packId, version }[]`

## 시나리오 ^steps

### S-001: core vocabulary seed

- **대상**: `seedEventSchemas`
- **전제**: adoption config 없음
- **기대**: `_core` vocabulary는 seed되고, `_mapping` synthetic fallback은 생성되지 않는다

### S-002: adoption 기반 materialization

- **대상**: `seedEventSchemas`
- **전제**: `shopping-web -> shop-pack@v1`, `infra-controller -> infra-observe-pack@v1`
- **기대**: 각 서비스에 해당 pack의 event schema가 materialize되고 description에 `packs:` 메타데이터가 포함된다

### S-003: allowedCategories 필터

- **대상**: `seedEventSchemas`
- **전제**: `shopping-web` adoption에 `allowedCategories=["navigation"]`
- **기대**: navigation category만 materialize되고 다른 category는 제외된다

### S-004: pack registry 조회

- **대상**: `GET /api/event-catalog/packs`, `GET /api/event-catalog/packs/:packId`
- **기대**: `packId`, `owner`, `domain`, `version`, `status`가 노출된다

### S-005: adoption CRUD

- **대상**: `GET/PUT/DELETE /api/event-catalog/adoptions/:serviceId`
- **기대**: canonical `{ packId, version }[]`만 허용하고, 생성/수정/삭제가 일관된 serviceId 기준으로 동작한다

### S-006: service taxonomy read model

- **대상**: `GET /api/event-catalog/services/:serviceId/taxonomy`
- **기대**: adoption, ownership, materialized summary, drift가 함께 반환된다

### S-007: service check/assert

- **대상**: `GET /api/event-catalog/services/:serviceId/taxonomy/check`
- **대상**: `POST /api/event-catalog/services/:serviceId/taxonomy/assert`
- **기대**: drift가 없으면 `ok=true`, assert는 성공한다. drift가 있으면 assert는 409로 실패한다

### S-008: catalog check/assert

- **대상**: `GET /api/event-catalog/taxonomy/check`
- **대상**: `POST /api/event-catalog/taxonomy/assert`
- **기대**: 대상 집합은 `adoption 선언 서비스 + active pack owner 서비스`로 계산되고, failing service count가 반환된다

### S-009: ownership consistency gate

- **대상**: service taxonomy drift
- **전제**: 서비스가 외부 pack을 채택
- **기대**: 그 pack이 요구하는 prefix가 ownership과 맞지 않으면 `adopted-prefixes-without-ownership` drift로 잡힌다

### S-010: canonical-only contract

- **대상**: adoption write/read/runtime
- **기대**: legacy string pack ref는 거부되고, runtime seed에서도 materialize 경로에 들어가지 않는다

## 검증 ^assertions

- vocabulary/pack/adoption/materialization/gate 레이어가 서로 책임을 침범하지 않는다
- pack registry는 version/status를 포함한 현재 계약을 노출한다
- adoption은 canonical `{ packId, version }[]` 기준으로만 저장/조회/실체화된다
- service/catalog 단위 `check/assert`가 동일한 drift vocabulary를 사용한다
- ownership consistency gate는 self-owned pack이 아니라 외부 pack 채택에 대해서만 동작한다
