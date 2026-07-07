---
def:
  id: authorization-graph-store
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [security, observability, structural]
  links:
    - target: authorization-ontology-system
      type: refines
    - target: authorization-management-usecases
      type: depends_on
    - target: authorization-ontology-audit-layer
      type: depends_on
sources:
  - packages/authorization-ontology/src/index.ts
  - packages/authorization-ontology/src/index.test.ts
---

# Authorization Graph Store — 권한 graph snapshot 저장 계약

## 목적 ^purpose

`AuthorizationOntologyGraph` snapshot을 저장, 조회, 목록화, 삭제, diff할 수 있는 최소 store 계약을 정의한다. 목표는 projector와 audit 결과를 일회성 객체가 아니라 운영 데이터로 보존할 수 있게 하는 것이다.

## 정의 ^defines

### Store contract

`AuthorizationGraphStore`는 다음 surface를 가진다.

- `saveSnapshot(input)`
- `getSnapshot(snapshotId)`
- `listSnapshots(filter?)`
- `deleteSnapshot(snapshotId)`

### Snapshot record

snapshot record는 다음 필드를 가진다.

- `snapshotId`
- `graphId`
- `graph`
- `createdAt`
- `sourceRef`
- `tags`
- `labels`
- `metadata`
- `auditReport`

`saveSnapshot({ audit: true })`를 사용하면 저장 시점에 `auditAuthorizationGraph()` 결과를 함께 저장한다.

### In-memory adapter

초기 구현은 `InMemoryAuthorizationGraphStore`다. 이 adapter는 테스트, CLI 조립, web API adapter 구현 전 단계의 기준 구현으로 사용한다.

### Diff

`diffAuthorizationGraphs(from, to)`는 node/relation/realm id 기준의 added/removed diff를 반환한다.

`diffAuthorizationGraphSnapshots(store, fromSnapshotId, toSnapshotId)`는 store에서 snapshot을 읽어 diff를 계산한다.

### Ingest service

`AuthorizationGraphIngestService`는 projector 결과를 store snapshot으로 저장하는 코어 서비스다.

지원하는 ingest kind:

- `graph`
- `authorization_decision`
- `cerbos_decision`
- `permission_engine_audit`
- `permission_engine_middleware_feedback`

`mergeWithLatest: true`를 사용하면 같은 `graphId`의 최신 snapshot과 새 projection을 merge한 뒤 저장한다. 이때 이전 snapshot과 새 snapshot의 diff도 함께 반환한다.

## 소비 ^consumes

- `auditAuthorizationGraph`
- `AuthorizationOntologyGraph`
- `AuthorizationGraphStore`
- `InMemoryAuthorizationGraphStore`
- `AuthorizationGraphIngestService`
