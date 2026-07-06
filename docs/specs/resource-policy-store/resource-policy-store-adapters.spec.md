---
def:
  id: resource-policy-store-adapters
  type: spec
  tier: system
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: resource-policy-store
  tags: [database, runtime, structural]
  links:
    - target: resource-policy-store-system
      type: refines
    - target: db-bootstrap
      type: depends_on
    - target: drizzle-orm-convention
      type: depends_on
sources:
  - packages/resource-policy-store/src/factory.ts
  - packages/resource-policy-store/src/sqlite/adapter.ts
  - packages/resource-policy-store/src/sqlite/schema.ts
  - packages/resource-policy-store/src/pg/adapter.ts
  - packages/resource-policy-store/src/pg/schema.ts
---

# resource-policy-store adapters

## 목적 ^purpose

`ResourcePolicyRegistry` 동작을 SQLite와 PostgreSQL 양쪽에서 같은 port contract로 제공하는 저장소 구현 경계다.

## 구성 ^overview

- `createResourcePolicyRegistry`는 `dialect: "sqlite" | "pg"`와 이미 생성된 Drizzle DB를 받아 adapter를 반환한다.
- SQLite adapter는 local/test-friendly registry 구현과 DDL을 제공한다.
- PostgreSQL adapter는 `auth.resource_policies` schema, check constraint, index, RLS-ready DDL을 제공한다.
- deprecated `DrizzleResourcePolicyRegistry` alias는 기존 SQLite 호출자 호환성만 위해 유지된다.

## 제약 ^constraint

- dialect driver는 dynamic import로 분리하여 사용하지 않는 dialect의 optional dependency가 package import를 깨지 않게 한다.
- adapter는 `permission-engine`의 순수 FSM 함수 결과를 영속화하며, 상태 전이 규칙을 별도로 복제하지 않는다.
