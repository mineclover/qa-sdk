---
def:
  id: resource-policy-store-system
  type: spec
  tier: layout
  owner_system: resource-policy-store
  scope: state
  aspect: domain_state
  depth: overview
  lifecycle: approved
  layer: domain
  svc: resource-policy-store
  tags: [authorization, database, runtime, structural]
  links:
    - target: permission-engine-spec
      type: implements
    - target: authorization-ontology-resource-lifecycle
      type: traces_to
    - target: authorization-ontology-rls-enforcement
      type: constrains
    - target: resource-policy-store-port
      type: refs
    - target: resource-policy-store-adapters
      type: refs
    - target: resource-policy-store-rls
      type: refs
    - target: resource-policy-store-validation
      type: refs
  sources:
    - packages/resource-policy-store/src/index.ts
    - packages/resource-policy-store/src/factory.ts
---

# resource-policy-store system

## 목적 ^purpose

`permission-engine`의 `ResourcePolicyRegistry` 포트를 SQLite와 PostgreSQL 저장소로 구현하는 권한 리소스 lifecycle store다. 권한 판정의 Pass 2에서 resource instance 상태(`UNREGISTERED`, `REGISTERED`, `DELEGATED`)와 owner/delegation metadata를 조회할 수 있게 한다.

## 구성 ^overview

- `resource-policy-store-port`: public interface re-export 경계. 포트 타입의 SSOT는 `permission-engine`이며 이 패키지는 소비 진입점을 제공한다.
- `resource-policy-store-adapters`: SQLite/PG schema와 adapter, dialect factory를 닫는 저장소 구현 경계.
- `resource-policy-store-rls`: PostgreSQL RLS bit catalog와 RLS-aware adapter 경계.
- `resource-policy-store-validation`: adapter parity, state transition, RLS, E2E 검증 경계.

## 책임 경계 ^constraint

- 권한 FSM 규칙과 error 타입의 원본은 `permission-engine`이다.
- 이 패키지는 policy row의 영속화와 dialect selection을 소유한다.
- PostgreSQL RLS 숫자 bit 값은 `packages/resource-policy-store/src/pg/rls-bits.ts`가 SSOT이며 SQL DDL의 숫자 리터럴 변경은 migration을 동반한다.
