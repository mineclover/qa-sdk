---
def:
  id: event-mapping-pack-plan
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
    - target: event-core-pattern
      type: depends_on
---

# Event Mapping Pack — 설계 계획

## 목적 ^purpose

이벤트→prefix 해석 규칙을 서비스나 도메인 단위로 독립 관리할 수 있도록 `mapping pack`을 first-class 개념으로 정의한다. 목적은 전역 vocabulary를 오염시키지 않고, 해석 규칙의 추가/분리/버전 전환을 pack 단위로 수행 가능하게 만드는 것이다.

## 구성 ^overview

- pack 식별자와 소유자
- pack에 속한 mapping 집합
- pack 버전과 활성 상태
- registry 조회 surface
- drift 검출 포인트

## 정의 초안 ^defines

```ts
interface EventMappingPack {
  packId: string;
  owner: string;                 // serviceId or packageId
  domain: string;
  version: string;
  mappings: EventPrefixMapping[];
  status: "draft" | "active" | "deprecated";
}
```

### pack이 답하는 질문

- 이 해석 규칙은 누구의 것인가?
- 어떤 이벤트들이 어떤 prefix 조합으로 투영되는가?
- 이 해석 규칙 묶음을 어느 서비스가 채택할 수 있는가?

### pack이 소유하는 것

- `event_key -> prefix dims` 해석
- pack 단위 버전
- pack 단위 owner
- pack 단위 상태

### pack이 소유하지 않는 것

- event 자체의 전역 의미
- 서비스별 최종 채택 여부
- prefix ownership

## 관리 규칙 ^constraint

1. 새 해석 규칙은 가능하면 기존 pack 수정이 아니라 새 pack 추가로 수용한다.
2. 공통 pack은 특정 서비스 전용 조건을 직접 포함하지 않는다.
3. pack version 변경은 서비스 adoption migration 없이 바로 전역 반영하지 않는다.
4. pack은 side-effect registry에만 숨겨두지 않는다. 조회 가능한 registry surface를 가져야 한다.

## 권장 surface

- `GET /api/event-catalog/packs` ✅
- `GET /api/event-catalog/packs/:packId` ✅
- `GET /api/event-catalog/packs/:packId/mappings` 🔲 (pack detail의 하위 surface로 분리할지 결정 필요)

## drift 포인트

- pack 정의는 있는데 registry materialization에 반영 안 됨
- pack version은 바뀌었는데 adoption이 이전 version 유지
- pack owner와 실제 유지보수 서비스가 불일치

## 시나리오 연결

- UC-2 Mapping Pack 추가
- UC-4 서비스별 override
- UC-8 Pack 버전 전환

## 평가

- 관리 용이성: 높음
- 확장성: 높음
- 구현 난이도: 중간
- 선행 조건: registry가 pack 단위를 직접 조회할 수 있어야 함

## 현재 구현 상태

- pack registry 존재
- pack owner/domain 조회 가능
- pack version/status 조회 가능
- event key → pack 역조회 가능
- 아직 없음:
  - pack lifecycle
  - pack 전용 drift gate
