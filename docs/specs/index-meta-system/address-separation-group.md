---
def:
  id: address-separation-group
  tier: system
  address: def_document:v2:273408
  scope: constraint
  aspect: tech_constraint
  depth: overview
  lifecycle: approved
  layer: domain
  svc: index-meta
  tags: [structural, decision]
  links:
    - target: address-separation-decision
      type: contains
    - target: address-separation-rollout
      type: contains
    - target: index-meta-system
      type: depends_on
sources:
  - docs/specs/index-meta-system/address-separation-group/address-separation-decision.spec.md
  - docs/specs/index-meta-system/address-separation-group/address-separation-rollout.spec.md
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/meta-registry.ts
  - packages/index-meta/src/address-protocol-manager.test.ts
  - packages/index-meta/src/meta-registry.test.ts
---

# Address Separation ADR 그룹

## 목적 ^purpose

address/registry 분리 ADR을 결정 근거와 구현된 도입 기준으로 나눠 변경 판단과 이행 전략을 분리해 기록한다.

## 구성 ^overview

- `address-separation-decision`: `AddressProtocolManager`와 `MetaRegistry`의 책임 분리 결정을 정리한 문서.
- `address-separation-rollout`: address 설정 유무, layout protocol 사용, backward-compatible 위임 경로를 정리한 문서.

## 상태

implemented

## 구현 경계

- `AddressProtocolManager`는 registry 없이 VersionedValue와 protocol 문자열을 변환하는 독립 게이트웨이다.
- `MetaRegistry`는 생성 시 address config를 검증하고, serialize/parse/converter/defaultProtocol을 address manager에 위임한다.
- `MetaRegistry.parse()`는 address manager의 loose parse 결과에 index/version 존재성과 value 범위 검증을 추가한다.
- `MetaCodec`은 entity ID와 VersionedValue 변환을 맡고, address protocol lifecycle을 소유하지 않는다.

원본: `docs/specs/indexing/index-meta/adr-address-separation.md` (`adr-address-separation`)
