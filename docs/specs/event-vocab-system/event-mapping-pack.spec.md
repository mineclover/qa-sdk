---
def:
  id: event-mapping-pack-spec
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
    - target: event-core-pattern
      type: depends_on
    - target: event-taxonomy-role-contract
      type: depends_on
sources:
  - packages/event-catalog/src/prefix-mapping.ts
  - packages/event-catalog/src/prefix-mapping.test.ts
  - packages/registry-service/src/modules/events/event-catalog.service.ts
  - packages/registry-service/src/modules/events/event.controller.test.ts
---

# Event Mapping Pack

## 목적 ^purpose

이벤트를 prefix 조합으로 해석하는 규칙 묶음을 `mapping pack` 단위로 고정한다. 이 문서는 전역 event 의미와 서비스별 채택 사이에 위치한 해석 레이어의 계약을 정의한다.

## 구성 ^overview

- pack 식별자
- pack owner
- pack domain
- pack version/status
- mapping 집합

## 정의 ^defines

```ts
interface EventMappingPack {
  packId: string;
  owner: string;
  domain: string;
  version: string;
  status: "draft" | "active" | "deprecated";
  mappings: EventPrefixMapping[];
}
```

## 책임 ^contract

소유:
- `event_key -> prefix` 해석 규칙
- pack owner
- pack version/status

비소유:
- event 자체의 전역 의미
- 서비스별 채택 여부
- prefix ownership
- materialized event schema

## 규칙 ^rules

1. pack은 해석 규칙을 정의하지만 서비스를 선택하지 않는다.
2. pack version 변경은 adoption pin과 분리해서 강제 반영하지 않는다.
3. 공통 pack은 특정 서비스 전용 정책을 직접 포함하지 않는다.
4. pack은 조회 가능한 registry surface를 가져야 한다.

## surface

- `GET /api/event-catalog/packs`
- `GET /api/event-catalog/packs/:packId`

## 현재 구현 메모

- pack registry 존재
- owner/domain/version/status 조회 가능
- event key -> pack 역조회 가능
