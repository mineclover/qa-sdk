---
def:
  id: audit-recorder-store-adapters
  type: spec
  tier: system
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: audit-recorder-store
  tags: [database, observability, runtime, structural]
  links:
    - target: audit-recorder-store-system
      type: refines
    - target: db-bootstrap
      type: depends_on
    - target: drizzle-orm-convention
      type: depends_on
  sources:
    - packages/audit-recorder-store/src/sqlite/adapter.ts
    - packages/audit-recorder-store/src/sqlite/schema.ts
    - packages/audit-recorder-store/src/pg/adapter.ts
    - packages/audit-recorder-store/src/pg/schema.ts
---

# audit-recorder-store adapters

## 목적 ^purpose

Audit execution/check tree를 SQLite와 PostgreSQL 양쪽에서 같은 `AuditRecorder` contract로 저장하고 조회하는 persistence boundary다.

## 구성 ^overview

- SQLite adapter는 local/test execution에서 audit tree invariant를 검증하기 쉬운 Drizzle store를 제공한다.
- PostgreSQL adapter는 `audit.audit_entries` schema, JSONB metadata, check constraint, query indexes, RLS-ready DDL을 제공한다.
- `listByRoot`는 같은 root의 entry를 depth와 start time 기준으로 안정 정렬한다.
- `firstFailure`는 nested audit tree에서 첫 deny/failure entry를 replay surface로 노출한다.

## 제약 ^constraint

- parent가 없는 child execution/check는 기록하지 않는다.
- execution finish는 execution entry에만 허용한다.
- metadata serialization 방식은 dialect 특성에 맞추되 public `AuditEntry` shape는 유지한다.
