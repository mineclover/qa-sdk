---
def:
  id: address-scenarios-group
  tier: layout
  address: def_document:v2:68608
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: index-meta
  tags: [structural, testing]
  links:
    - target: address-scenarios-parse
      type: refs
    - target: address-scenarios-runtime
      type: refs
    - target: index-meta-system
      type: depends_on
sources:
  - docs/specs/index-meta-system/address-scenarios-group/address-scenarios-parse.spec.md
  - docs/specs/index-meta-system/address-scenarios-group/address-scenarios-runtime.spec.md
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/address-protocol-manager.test.ts
  - packages/index-meta/src/meta-registry.ts
---

# Address 시나리오 그룹

## 목적 ^purpose

AddressProtocolManager 시나리오를 registry 검증 전 파싱 계층과 런타임 프로토콜 관리 계층으로 분리해 외부 시스템 통합 경로를 단계별로 정리한다.

## 구성 ^overview

- `address-scenarios-parse`: `AddressProtocolManager.parse()`의 loose parse, `MetaRegistry.parse()`의 validated parse, registry 없는 format conversion 시나리오를 정리한다.
- `address-scenarios-runtime`: protocol register/unregister, negotiation, read/write protocol 전환, fallback chain, schema-only registry consumer 시나리오를 정리한다.

## 책임 경계

- `AddressProtocolManager`는 VersionedValue와 주소 문자열 사이의 protocol gateway다. registry의 index/version 존재성이나 value 범위는 검증하지 않는다.
- `MetaRegistry`는 `AddressProtocolManager`의 loose parse 결과에 registry 검증을 추가한다.
- schema-only consumer는 address 직렬화 계약을 소유하지 않고 registry 조회/codec 소비 경로만 사용한다.

## 검증 근거

- `address-protocol-manager.test.ts`의 §17은 loose parse, schema-only route extraction, format conversion을 검증한다.
- `address-protocol-manager.test.ts`의 §18은 런타임 프로토콜 lifecycle과 fallback/read protocol 우선순위를 검증한다.
- `address-protocol-manager.test.ts`의 §19와 MetaRegistry.address 통합 테스트는 schema-only consumer와 validated parse 경계를 검증한다.

원본: `docs/specs/indexing/index-meta/scenarios-address.spec.md` (`address-scenarios`)
