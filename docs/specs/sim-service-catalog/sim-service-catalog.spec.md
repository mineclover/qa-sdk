---
def:
  id: sim-service-catalog
  type: spec
  tier: system
  level: leaf
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: sim-service-catalog
  tags: [simulator, catalog, version, topology]
  links:
    - target: system-libraries
      type: refines
  sources:
    - packages/sim-service-catalog/src/index.ts
    - packages/sim-service-catalog/src/types.ts
    - packages/sim-service-catalog/src/get-current-topology.ts
    - packages/sim-service-catalog/src/get-service-version-tag.ts
    - packages/sim-service-catalog/src/transition-state.ts
---

# sim-service-catalog

## 목적 ^purpose

시뮬 서비스의 prefix/state/version axis 조작을 위한 카탈로그 layer. qa-sdk catalog version axis 위에서 currentTopology, version-tag, transition-state를 조회/조작한다.

## 구성 ^overview

시뮬 서비스 버전 카탈로그의 타입과 조작 함수로 구성된다.

- `types.ts` — `CatalogPrefixDefinition`, `ServiceState`, `Topology`, `TransitionLog`, `VersionEntry` 타입.
- `get-current-topology.ts` — catalog `refEntries`를 stable/candidate/retired topology로 분류한다.
- `get-service-version-tag.ts` — service prefix와 version tag를 조회한다.
- `transition-state.ts` — candidate 기반 state transition과 transition log를 생성한다.
- `index.ts` — 위 모듈의 공개 export surface.
