---
def:
  id: event-taxonomy-layering-plan
  level: module
  tier: system
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  svc: event-catalog
  tags: [cross-scope, structural, observability]
  links:
    - target: event-vocab-system
      type: refines
    - target: event-core-pattern
      type: contains
    - target: event-mapping-pack-plan
      type: contains
    - target: service-event-adoption-plan
      type: contains
    - target: service-ownership-spec
      type: contains
---

# Event Taxonomy Layering — 설계 계획

## 목적 ^purpose

event taxonomy를 확장 가능하게 관리하기 위해, 전역 이벤트 vocabulary와 이벤트→prefix 해석, 그리고 서비스별 채택을 3개 층으로 분리하는 설계 계획을 정리한다.

## 구성 ^overview

- Layer 1: global event vocabulary
- Layer 2: mapping pack taxonomy
- Layer 3: service event adoption
- registry seed와 서비스 topology가 이 3층을 어떻게 읽을지의 방향

## 설계 방향

### Layer 1 — Global Event Vocabulary

- 소유: `CoreEventDef`, `EventCategory`, `PayloadFieldGuide`, `GraphHint`
- 질문: "이 이벤트는 전역적으로 어떤 실행 패턴인가?"
- 대표 문서: `event-core-pattern`, `payload-guide`, `graph-hint-spec`

### Layer 2 — Mapping Pack Taxonomy

- 소유: `EventPrefixMapping[]`
- 질문: "이 이벤트를 이 도메인/서비스에서는 어떤 prefix 조합으로 해석하는가?"
- 예시 pack:
  - shop pack
  - harness pack
  - decision-observe pack
  - infra-observe pack
  - cli-observe pack

권장 모델:

```ts
interface EventMappingPack {
  packId: string;
  owner: string;          // service or package
  domain: string;
  mappings: EventPrefixMapping[];
}
```

### Layer 3 — Service Event Adoption

- 소유: 서비스가 채택하는 event pack과 허용 category 범위
- 질문: "이 서비스는 어떤 event set을 실제로 말하는가?"

권장 모델:

```ts
interface ServiceEventAdoption {
  serviceId: string;
  eventPacks: { packId: string; version: string }[];
  allowedCategories?: string[];
}
```

## 제약 ^constraint

- core vocabulary는 서비스 소유권을 직접 가지지 않는다.
- mapping pack은 전역 side-effect registration에만 의존해서는 안 된다.
- service adoption은 `ownedPrefixes`를 대체하지 않고, event layer에서 이를 보강한다.
- registry seed는 `serviceId` 하드코딩 없이 service adoption을 읽어야 한다.

## 예상 효과

- core event는 안정적으로 유지
- 서비스별 해석은 pack으로 독립 관리
- 서비스 온보딩은 adoption layer 변경으로 제한
- registry가 service별 event schema를 일관되게 materialize 가능

## 다음 단계

- pack을 first-class로 다루는 registry surface 설계
- `seed-events`를 service adoption 기반으로 재구성
- service event taxonomy와 prefix ownership의 정합성 검증 규칙 추가
