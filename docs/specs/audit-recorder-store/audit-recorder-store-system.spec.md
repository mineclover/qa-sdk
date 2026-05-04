---
def:
  id: audit-recorder-store-system
  type: spec
  tier: layout
  owner_system: audit-recorder-store
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  svc: audit-recorder-store
  tags: [authorization, observability, database, runtime, structural]
  links:
    - target: permission-engine-spec
      type: implements
    - target: authorization-ontology-nested-audit-tracing
      type: traces_to
    - target: authorization-ontology-rls-enforcement
      type: constrains
    - target: audit-recorder-store-port
      type: refs
    - target: audit-recorder-store-adapters
      type: refs
    - target: audit-recorder-store-rls-shadow
      type: refs
    - target: audit-recorder-store-validation
      type: refs
  sources:
    - packages/audit-recorder-store/src/index.ts
    - packages/audit-recorder-store/src/factory.ts
---

# audit-recorder-store system

## 목적 ^purpose

`permission-engine`의 `AuditRecorder` 포트를 SQLite와 PostgreSQL 저장소로 구현하여 권한 실행 trace, nested check tree, first failure replay를 영속화하는 audit store다.

## 구성 ^overview

- `audit-recorder-store-port`: package public surface와 dialect factory 경계.
- `audit-recorder-store-adapters`: SQLite/PG audit entry schema와 adapter 경계.
- `audit-recorder-store-rls-shadow`: PostgreSQL RLS 전환을 위한 shadow decision 기록 경계.
- `audit-recorder-store-validation`: tree invariant, adapter parity, RLS policy, shadow recorder 검증 경계.

## 책임 경계 ^constraint

- `AuditRecorder` interface와 audit entry domain type의 원본은 `permission-engine`이다.
- 이 패키지는 nested audit tree의 영속화, 조회 정렬, first-failure replay를 소유한다.
- RLS shadow 기록은 hot path를 block하지 않는 fire-and-forget side channel로 유지한다.
