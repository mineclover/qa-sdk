---
def:
  id: resource-policy-store-validation
  type: spec
  tier: component
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: resource-policy-store
  tags: [authorization, testing, database]
  links:
    - target: resource-policy-store-system
      type: refines
    - target: resource-policy-store-adapters
      type: depends_on
    - target: resource-policy-store-rls
      type: depends_on
  sources:
    - packages/resource-policy-store/src/factory.test.ts
    - packages/resource-policy-store/src/port-contract.test.ts
    - packages/resource-policy-store/src/e2e-integration.test.ts
    - packages/resource-policy-store/src/pg/rls-policy.test.ts
    - packages/resource-policy-store/src/pg/rls-aware-adapter.test.ts
---

# resource-policy-store validation

## 목적 ^purpose

`ResourcePolicyRegistry` port, dialect adapter parity, lifecycle state transition, RLS policy, and authorization E2E behavior를 테스트로 고정한다.

## 구성 ^overview

- `factory.test.ts`: dialect selection과 unsupported dialect failure를 검증한다.
- `port.test.ts`와 `port-contract.test.ts`: permission-engine port identity와 SQLite/PG adapter parity를 검증한다.
- `sqlite/adapter.test.ts`와 `pg/adapter.test.ts`: dialect별 schema/constraint smoke를 검증한다.
- `pg/rls-bits.test.ts`, `pg/rls-policy.test.ts`, `pg/rls-aware-adapter.test.ts`, `pg/rls-regression.test.ts`: RLS bit catalog와 default deny/owner/admin behavior를 검증한다.
- `e2e-integration.test.ts`: bitmap, resource lifecycle, audit replay가 함께 동작하는 통합 흐름을 검증한다.
