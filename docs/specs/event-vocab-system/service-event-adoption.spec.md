---
def:
  id: service-event-adoption-spec
  level: leaf
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: event-catalog
  tags: [structural, observability]
  links:
    - target: event-vocab-system
      type: refines
    - target: event-mapping-pack-spec
      type: depends_on
    - target: service-ownership-spec
      type: depends_on
    - target: event-taxonomy-role-contract
      type: depends_on
---

# Service Event Adoption

## 목적 ^purpose

각 서비스가 어떤 mapping pack을 실제로 채택하는지 고정한다. 이 문서는 prefix ownership과 별개로 event layer에서의 서비스 채택 계약을 정의한다.

## 구성 ^overview

- serviceId
- 채택 pack 목록
- pack version pin
- allowed category 범위

## 정의 ^defines

```ts
interface ServiceEventAdoption {
  serviceId: string;
  eventPacks: { packId: string; version: string }[];
  allowedCategories?: string[];
}
```

## 책임 ^contract

소유:
- service별 pack 채택
- pack version pin
- allowed category 범위

비소유:
- event 의미
- prefix mapping 규칙
- prefix ownership 자체

## ownership 관계 ^constraint

- `ServiceOwnershipSpec`은 prefix 생산/소비를 소유한다.
- `ServiceEventAdoption`은 event pack 채택을 소유한다.
- 둘은 서로 대체하지 않는다.

현재 canonical gate policy:

1. self-owned pack은 ownership consistency gate에서 제외한다.
2. 외부 pack 채택만 ownership consistency gate 대상으로 본다.
3. catalog gate 대상은 `adoption 선언 서비스 + active pack owner 서비스`다.

## surface

- `GET /api/event-catalog/adoptions`
- `GET /api/event-catalog/adoptions/:serviceId`
- `PUT /api/event-catalog/adoptions/:serviceId`
- `DELETE /api/event-catalog/adoptions/:serviceId`
- `GET /api/event-catalog/services/:serviceId/taxonomy`
- `GET /api/event-catalog/services/:serviceId/taxonomy/check`
- `POST /api/event-catalog/services/:serviceId/taxonomy/assert`
- `GET /api/event-catalog/taxonomy/check`
- `POST /api/event-catalog/taxonomy/assert`

## drift

- `adoption-missing`
- `missing-pack-ids`
- `stale-pack-versions`
- `adopted-prefixes-without-ownership`
- `records-without-pack-metadata`
- `prefixes-without-ownership`

## 현재 구현 메모

- canonical `{ packId, version }[]`만 허용
- read/write/runtime 모두 canonical-only
- catalog/service 단위 check/assert 존재
- 운영 entrypoint `pnpm gate:event-taxonomy` 존재
