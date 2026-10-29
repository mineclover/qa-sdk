---
def:
  id: dkg-state-store
  tier: system
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [observability, persistence, data, cross-scope]
  links:
    - target: dkg-node-types
      type: contains
    - target: dkg-edge-types
      type: contains
    - target: dkg-skill-catalog
      type: depends_on
    - target: dkg-state-store-graph
      type: contains
    - target: dkg-state-store-observability
      type: contains
sources:
  - packages/dkg-store/src/dkg-sqlite-store.ts
  - packages/dkg-store/src/dkg-sqlite-store.test.ts
  - packages/dkg/src/usage-types.ts
  - packages/dkg-store/src/db/schema.ts
  - packages/dkg/src/graph-registry.ts
---
# DKG State Store

## 목적 ^purpose

DKG 그래프와 그 관측 부산물의 저장 계약과 facet 경계를 정의한다. backend 선택은 이 문서의 핵심 계약이 아니며, 현재 SQLite/Drizzle 구현은 `packages/dkg-store` adapter가 소유한다. graph state, usage snapshot, CLI audit event는 같은 저장소를 사용하더라도 목적별 facet과 불변식을 분리한다.

## 구성 ^overview

- `dkg-state-store-graph`
  DKG 노드/엣지와 메타 키를 어떻게 저장하고 bootstrap/manual/auto source를 분리하는지 정의한다.
- `dkg-state-store-observability`
  usage snapshot, version usage, CLI audit event를 어떻게 관측/감사 표면으로 저장하는지 정의한다.

## 경계

- graph facet
  `saveGraph`, `saveNodes`, `loadGraph`, `clearBootstrap`, `clearOperational`
- observability facet
  `saveUsageSnapshot`, `loadRecentVersionUsages`, `saveCliAuditEvent`, `listRecentCliAuditEvents`

## 관련 소스

- `packages/dkg-store/src/dkg-sqlite-store.ts` — 현재 SQLite adapter
- `packages/dkg-store/src/db/schema.ts` — adapter schema/migration
- `packages/dkg/src/node-contract.ts` — Decision/Observation pure contract
- `packages/dkg/src/usage-snapshot-contract.ts` — UsageSnapshot pure contract
