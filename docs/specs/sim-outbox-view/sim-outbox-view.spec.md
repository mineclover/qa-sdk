---
def:
  id: sim-outbox-view
  type: spec
  tier: system
  level: leaf
  scope: interface
  aspect: event_contract
  depth: specification
  lifecycle: approved
  layer: operation
  svc: sim-outbox-view
  tags: [simulator, contract, view, outbox, admin]
  links:
    - target: system-libraries
      type: refines
  sources:
    - packages/sim-outbox-view/src/index.ts
---

# sim-outbox-view

## 목적 ^purpose

approval-api 의 outbox admin endpoint 가 반환하는 응답 shape 을 producer(`sim-approval-api` OutboxAdminController)와 consumer(`sim-handles` outbox-client) 양쪽이 같은 zod schema 로 검증하도록 SSOT 를 고정한다. 본 패키지의 schema/type 을 import 하지 않으면 typecheck 또는 zod parse 단계에서 drift 가 검출된다.

## 구성 ^overview

단일 모듈 `index.ts` 가 두 개 응답 shape 을 export 한다.

- `OutboxInsertResponseSchema` / `OutboxInsertResponse` — outbox insert admin 호출 응답. `inserted` count, `idempotencyKeys`, `ids` 배열.
- `OutboxDispatchResponseSchema` / `OutboxDispatchResponse` — outbox dispatch admin 호출 응답. `byReplica` 별 `dispatchedEventIds`, `totalDispatched`, `duplicates`, `durationMs`.

원본 admin endpoint 정의는 `docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md` §9 를 따른다 — 본 spec 은 그 endpoint 의 응답 boundary view 만 책임진다.
