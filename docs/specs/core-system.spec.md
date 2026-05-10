---
def:
  id: qa-sdk-core-system
  type: spec
  tier: system
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: core
  tags: [structural, runtime]
  links:
    - target: weighted-index-system
      type: depends_on
    - target: indexing-core-system
      type: depends_on
    - target: index-meta-system
      type: depends_on
    - target: sdk-system
      type: depends_on
    - target: platform-chain-system
      type: depends_on
    - target: wi-api
      type: refs
    - target: sdk-api-surface
      type: refs
---

# QA-SDK Core System

## 목적 ^purpose

전체 QA-SDK 시스템에서 공통으로 사용되는 핵심 데이터 모델, 공통 상수, 타입 정의를 소유한다. 

## 구성 ^overview

- `weighted-index-system`: 주소 압축/해석의 수학적 core.
- `indexing-core-system`: 좌표계 기반 원리, schema layer, traversal, table system.
- `index-meta-system`: index metadata registry, codec, resolver, SDK 시나리오.
- `sdk-system`: public SDK API surface, constants, dimension view.
- `platform-chain-system`: platform runtime 공통 codec/context/logger/sdk 계약.
- `wi-api`, `sdk-api-surface`: 외부 소비자가 직접 사용하는 core public API.
