---
def:
  id: audit-recorder-store-rls-shadow
  type: spec
  tier: system
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: audit-recorder-store
  tags: [authorization, observability, security, database]
  links:
    - target: audit-recorder-store-system
      type: refines
    - target: authorization-ontology-rls-enforcement
      type: implements
sources:
  - packages/audit-recorder-store/src/pg/shadow-recorder.ts
  - packages/audit-recorder-store/src/pg/shadow-schema.ts
---

# audit-recorder-store RLS shadow

## 목적 ^purpose

application-layer authorization decision과 PostgreSQL RLS prediction을 같은 record에 남겨 RLS enforce 전환 시 divergence를 관측하는 shadow-mode 기록 경계다.

## 구성 ^overview

- `audit.rls_shadow_decisions`는 operation, application decision, RLS prediction, divergence, user/request context를 저장한다.
- `PgRlsShadowRecorder.record()`는 fire-and-forget insert를 수행하고 실패는 logger에만 남긴다.
- shadow table policy는 admin read와 self insert 조건을 기준으로 한다.

## 제약 ^constraint

- shadow 기록 실패는 권한 요청 hot path를 실패시키지 않는다.
- table identifier override는 `sql.unsafe`를 사용하므로 caller가 trusted table ref만 전달해야 한다.
- shadow decision은 audit entry tree를 대체하지 않고 RLS migration evidence만 제공한다.
