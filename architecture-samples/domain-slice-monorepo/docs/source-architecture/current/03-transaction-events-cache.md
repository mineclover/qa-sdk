# Transaction, Events, and Cache

## Source Mapping

This document adapts:

- `raw/Saga-트랜잭션-및-이벤트-처리-명세서.md`
- `raw/Write-Model-및-Command-인터페이스-명세서.md`
- `raw/Read-Model-및-조회-인터페이스-명세서.md`

## Transaction API

Transaction API belongs to the use case consistency boundary.

The application layer may depend on a transaction port, but must not depend on a
database transaction implementation.

Recommended shape:

```text
TransactionPort.run("assignment.create", async (scope) => {
  await repository.save(entity, scope)
  await outbox.append(event, scope)
})
```

- write model save and outbox append are atomic when event publication matters
- infrastructure can stage aggregate snapshots and outbox records in one unit
  of work before commit
- failures must discard both staged state and staged outbox records
- idempotency belongs to command handling, not controller memory
- retry-safe commands need command id or idempotency key
- infrastructure maps transaction scope to actual DB/session primitives

Reference implementation:

- `apps/api/src/modules/assignment/application/ports/assignment-transaction.port.ts`
- `apps/api/src/modules/assignment/infrastructure/transaction/assignment.drizzle-transaction.ts`
- `apps/api/src/modules/assignment/infrastructure/transaction/assignment.transaction.ts`
- `apps/api/src/modules/assignment/infrastructure/transaction/assignment.unit-of-work.ts`
- `apps/api/src/modules/assignment/application/use-cases/assignment.use-case.ts`

## Outbox

Outbox is the default event reliability boundary.

Use it when:

- a write emits a domain event
- read model projection depends on the event
- another domain reacts asynchronously
- audit/logging needs durable evidence

Do not publish directly from domain entity. Domain may produce intent;
application or infrastructure handles reliable publication. The topology rule
for `outbox/*.outbox.ts` is defined in [README.md](README.md#responsibility-topology).

Reference implementation:

- `apps/api/src/modules/assignment/application/ports/assignment-outbox.port.ts`
- `apps/api/src/modules/assignment/infrastructure/outbox/assignment.outbox.ts`

## Saga

Saga is required when one business process spans multiple domain consistency
boundaries.

Use saga only after verifying that a single use case transaction cannot own the
whole invariant.

Saga documentation must include:

- forward steps
- compensation steps
- retry policy
- timeout policy
- observable event/log vocabulary

## Cache Key DSL

Cache key is metadata, not an ad hoc string.

Canonical shape:

```text
prefix:version:id[:id...]
```

Examples:

```text
assignment-read-model:v1:assignment-123
assignment-bff-detail:v1:assignment-123:user-456
```

- prefix is governed by metadata/DSL
- version appears before business identifiers
- PII segments are hashed or avoided
- cache invalidation path is named in the feature design

Reference metadata:

- `apps/api/src/modules/assignment/metadata/openmetadata.seed.json`

## CQRS Cache Decision

| Cache target | Usually valid? | Note |
|---|---:|---|
| write model entity | no | risks hiding consistency bugs |
| command idempotency | yes | short TTL or durable table |
| read model row | yes | versioned prefix |
| BFF composition | yes | UI-specific invalidation |
| OpenMetadata seed | no | source file is SSOT |
