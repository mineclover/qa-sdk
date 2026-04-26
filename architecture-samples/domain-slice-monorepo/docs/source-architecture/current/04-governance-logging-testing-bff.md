# Governance, Logging, Testing, and BFF

## Source Mapping

This document adapts:

- `raw/데이터-거버넌스-및-메타데이터-관리-전략.md`
- `raw/메타데이터-태깅-및-데이터-품질-구현-규약.md`
- `raw/공통-예외-처리-및-에러-응답-규약.md`
- `raw/계층별-테스트-전략-및-규약.md`
- `raw/테스트-용이성-규약.md`

## Governance Metadata

Every data-producing slice should ship governance metadata near the slice:

```text
metadata/openmetadata.seed.json
```

Required when a slice owns:

- database table
- read model
- BFF cache with business semantics
- emitted event used by another domain
- data quality expectation

Metadata must cover:

- domain owner
- glossary terms
- lineage
- quality tests
- cache key prefixes

Cache key shape and cache target decisions are owned by
[03-transaction-events-cache.md](03-transaction-events-cache.md#cache-key-dsl).

## Logging Spec

Logging is an observable contract.

Minimum fields:

- `traceId`
- `correlationId`
- `domain`
- `useCase`
- `aggregateId`
- `commandName` or `queryName`
- `eventName` and `eventVersion` when event is emitted
- `outcome`
- `errorCode`
- `cacheKeyPrefix` and `cacheHit` when cache is used

Do not add free-form logs without deciding which test or dashboard consumes
them.

Reference implementation:

- `apps/api/src/modules/assignment/application/ports/assignment-logger.port.ts`
- `apps/api/src/modules/assignment/infrastructure/logging/assignment.logger.ts`

## Error Contract

Domain exceptions stay framework-free. Presentation maps them into API error
payloads.

Recommended payload:

```json
{
  "code": "ASSIGNMENT_CANCELLED",
  "message": "Cancelled assignment cannot be assigned.",
  "traceId": "trace-id",
  "details": {}
}
```

Infrastructure errors are wrapped at adapter boundaries before crossing into
application behavior.

## Test Layers

| Layer | Test focus |
|---|---|
| domain | invariant behavior, invalid transitions |
| application | port interactions, transaction/outbox behavior |
| infrastructure | persistence mapping, adapter errors |
| presentation/BFF | contract shape, mapping, auth/context |
| scenario | write/read/log/event side effects |

Tests should avoid global time/randomness. Inject clock/id generator when the
behavior depends on them.

Current test boundary examples:

- `assignment-domain.test.ts`: pure entity state transition and named exception
- `assignment-use-case.test.ts`: transaction scope propagation and log outcome
- `assignment-unit-of-work.test.ts`: commit/rollback and outbox encapsulation
- `assignment-drizzle-transaction.test.ts`: DB transaction client mapping
- `assignment-bff.test.ts`: read model to UI-facing model composition
- `assignment-projector.test.ts`: event payload to read model projection
- `billing-cross-domain-precondition.test.ts`: A read/version precondition before B write
- `openapi-merge.test.mjs`: API contract merge collision rules

## BFF Boundary

BFF/read model distinction is defined in [README.md](README.md#read-model-vs-bff).
This section only adds BFF guardrails.

Use BFF when:

- multiple domain read models are composed for one screen
- UI needs screen-specific permissions or presentation state
- response shape changes faster than domain read model shape

Do not put domain mutation, persistence writes, or business invariant decisions
inside BFF.

Reference implementation:

- `apps/api/src/modules/assignment/application/queries/assignment-read-model.query.ts`
- `apps/api/src/modules/assignment/infrastructure/read-model/assignment.read-model.ts`
- `apps/api/src/modules/assignment/presentation/bff/assignment-detail.bff.ts`
- `apps/api/src/modules/assignment/presentation/bff/assignment-detail.controller.ts`
- `apps/worker/src/projectors/assignment-read-model.projector.ts`
