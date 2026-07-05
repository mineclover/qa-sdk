---
def:
  id: system-libraries
  tier: layout
  owner_system: system-libraries
  address: def_document:v2:137231
  scope: flow
  aspect: relation
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [structural, entry-point]
  links:
    - target: sim-decision-view
      type: refs
    - target: sim-identifier-grammar
      type: refs
    - target: sim-service-catalog
      type: refs
    - target: sim-internal-network
      type: refs
    - target: sim-outbox-view
      type: refs
    - target: motion-content-system
      type: refs
    - target: wi-system
      type: refs
    - target: weighted-index-system
      type: refs
    - target: wi-trace-group
      type: refs
    - target: cq-system
      type: refs
    - target: indexing-core-system
      type: refs
    - target: index-meta-system
      type: refs
    - target: storage-system
      type: refs
    - target: platform-chain-system
      type: refs
    - target: qa-sdk-core-system
      type: refs
  sources:
    - scripts/package-surfaces.mjs
    - docs/specs/system/system-packages.spec.md
    - docs/specs/system/package-surface-separation.rule.md
    - packages/weighted-index/package.json
    - packages/index-meta/package.json
    - packages/core/package.json
    - packages/sdk/package.json
---
# 런타임 코어 라이브러리 표면

## 목적 ^purpose

서비스가 공유하는 좌표 인코딩, 주소 메타데이터, SDK/runtime 타입, 저장소 보조 surface를 찾기 위한 layout 문서다. 이 문서는 package ownership을 직접 정하지 않고 `Coordinate kernel`과 `Observability runtime` surface로 라우팅한다.

## 구성 ^overview

핵심 runtime surface:

- `Coordinate kernel`: weighted-index, bit-index, index-meta, permission-engine, address-index, tag-search, weighted-ui, weighted-wasm.
- `Observability runtime`: @qa-sdk/core, @qa-sdk/sdk, @qa-sdk/browser, ingest/registry/gate/query/decode service, logger/codec/context/store/engine 계열.
- `Spec analysis kernel`과 `Definition control plane`은 설계/검증 surface이므로 이 문서에서 library처럼 흡수하지 않고 `system-design-tools`와 `system-packages`로 보낸다.

부속: weighted-index-system/wi-trace-group(WI 도메인 루트 + 추적성), qa-sdk-core-system(공통 타입/상수/유틸).

## 검증 ^validation

```bash
corepack pnpm arch:surfaces
corepack pnpm arch:verify
```
