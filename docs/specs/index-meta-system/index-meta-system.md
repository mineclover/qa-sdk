---
def:
  id: index-meta-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: table-schema-spec
      type: contains
    - target: resolver-spec
      type: contains
    - target: index-codec-spec
      type: contains
    - target: index-meta-store
      type: contains
    - target: address-spec
      type: contains
    - target: adr-address-separation
      type: contains
    - target: sdk-scenarios
      type: contains
    - target: index-meta-sdk-spec
      type: contains
    - target: invariants-spec
      type: contains
    - target: address-scenarios
      type: contains
    - target: user-scenarios
      type: contains
    - target: canonical-format-spec
      type: contains
    - target: dx-lifecycle-spec
      type: contains
    - target: indexing-benchmarks
      type: contains
---

## 목적 ^purpose

MetaRegistry, PrefixDecoder, 주소 직렬화 등 좌표 시스템의 런타임 메타데이터 관리 레이어.

## 구성 ^overview

14개 정의: 테이블 스키마, 리졸버, 코덱, 스토어, 주소, ADR, SDK, 시나리오, 불변식, 정규화, DX 라이프사이클, 벤치마크.
