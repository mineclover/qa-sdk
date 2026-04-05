---
def:
  id: dkg-state-store
  level: module
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [observability, persistence, data]
  links:
    - target: dkg-node-types
      type: depends_on
    - target: dkg-edge-types
      type: depends_on
    - target: dkg-skill-catalog
      type: depends_on
    - target: dkg-state-store-graph
      type: contains
    - target: dkg-state-store-observability
      type: contains
---
# DKG State Store

## 목적 ^purpose

DKG 그래프와 그 관측 부산물을 로컬 SQLite에 영속하는 저장소 경계를 정의한다. `~/.qa-sdk/state.sqlite`에 graph state, usage snapshot, CLI audit event를 함께 보관하되 각 역할은 분리된 facet으로 관리한다.

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

- `packages/dkg/src/store/dkg-sqlite-store.ts`
- `packages/dkg/src/db/schema.ts`
