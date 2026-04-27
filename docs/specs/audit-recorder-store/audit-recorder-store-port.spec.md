---
def:
  id: audit-recorder-store-port
  type: spec
  tier: interface
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: operation
  svc: audit-recorder-store
  tags: [authorization, observability, contract]
  links:
    - target: audit-recorder-store-system
      type: refines
    - target: permission-engine-spec
      type: implements
  sources:
    - packages/audit-recorder-store/src/index.ts
    - packages/audit-recorder-store/src/factory.ts
---

# audit-recorder-store port

## 목적 ^purpose

호출자가 `dialect + db`만 선택해 `AuditRecorder` 구현을 얻도록 하는 package interface boundary다.

## 구성 ^overview

- `createAuditRecorder`는 `dialect: "sqlite" | "pg"`를 기준으로 concrete recorder를 dynamic import한다.
- `SqliteAuditRecorder`와 `PgAuditRecorder`는 public export로 제공된다.
- deprecated `DrizzleAuditRecorder` alias는 기존 SQLite 호출자 호환성만 위해 유지된다.

## 관련 소스

- `packages/audit-recorder-store/src/factory.ts` — dialect factory
- `packages/audit-recorder-store/src/index.ts` — public package surface
- `packages/audit-recorder-store/src/factory.test.ts` — dialect branch 검증
