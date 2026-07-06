---
def:
  id: resource-policy-store-rls
  type: spec
  tier: system
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: resource-policy-store
  tags: [authorization, database, security, structural]
  links:
    - target: resource-policy-store-system
      type: refines
    - target: authorization-ontology-rls-enforcement
      type: implements
    - target: db-bootstrap
      type: depends_on
sources:
  - packages/resource-policy-store/src/pg/rls-bits.ts
  - packages/resource-policy-store/src/pg/rls-aware-adapter.ts
  - packages/resource-policy-store/src/pg/schema.ts
---

# resource-policy-store RLS

## 목적 ^purpose

PostgreSQL RLS 정책이 application bitmap과 같은 bit address를 사용하도록 고정하고, RLS session context가 주입된 transaction 안에서 `ResourcePolicyRegistry` 호출을 실행하는 enforcement boundary다.

## 구성 ^overview

- `rls-bits.ts`는 resource/audit/ingest 관련 RLS bit address의 타입 레벨 SSOT다.
- `RlsAwarePgResourcePolicyRegistry`는 `db-bootstrap`의 `RlsTxRunner`를 통해 `SET LOCAL` session context를 주입한다.
- SQL policy DDL은 owner match, bitmap bit, admin bypass, default deny 조건을 DB boundary에서 적용한다.

## 제약 ^constraint

- RLS bit 숫자 변경은 SQL migration과 application bitmap 발급자 변경을 함께 요구한다.
- interceptor가 없는 CLI/worker 경로는 `overrideContext`를 명시해야 한다.
- RLS-aware adapter는 Drizzle transaction wrapper 대신 raw `postgres` transaction SQL을 사용한다.
