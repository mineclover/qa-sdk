---
def:
  id: audit-recorder-store-validation
  type: spec
  tier: component
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: audit-recorder-store
  tags: [authorization, observability, testing, database]
  links:
    - target: audit-recorder-store-system
      type: refines
    - target: audit-recorder-store-adapters
      type: depends_on
    - target: audit-recorder-store-rls-shadow
      type: depends_on
  sources:
    - packages/audit-recorder-store/src/factory.test.ts
    - packages/audit-recorder-store/src/port-contract.test.ts
    - packages/audit-recorder-store/src/e2e-integration.test.ts
    - packages/audit-recorder-store/src/pg/rls-policy.test.ts
    - packages/audit-recorder-store/src/pg/shadow-recorder.test.ts
---

# audit-recorder-store validation

## 목적 ^purpose

`AuditRecorder` dialect parity, nested tree invariant, first-failure replay, RLS policy, and RLS shadow-mode behavior를 테스트로 고정한다.

## 구성 ^overview

- `factory.test.ts`: dialect selection과 unsupported dialect failure를 검증한다.
- `sqlite/adapter.test.ts`, `pg/adapter.test.ts`, `port-contract.test.ts`: tree construction, parent validation, finish semantics, sorting, metadata roundtrip을 검증한다.
- `e2e-integration.test.ts`: resource-policy store와 audit store가 같은 authorization flow에서 공존하는지 검증한다.
- `pg/rls-policy.test.ts`, `pg/rls-regression.test.ts`: actor scope, read bit, admin bypass, FORCE RLS 회귀를 검증한다.
- `pg/shadow-schema.test.ts`, `pg/shadow-recorder.test.ts`: shadow table constraint와 fire-and-forget recorder behavior를 검증한다.
