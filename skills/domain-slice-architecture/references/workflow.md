# Domain Slice Workflow

## 1. Existing Domain Data Modeling Analysis

Read current tables, DTOs, event payloads, cache keys, API responses, and user-facing screens. Extract:

- stable identity
- state shape
- invariant behavior
- command inputs
- query/read shapes
- external system contracts
- ownership and lifecycle

Do not start by creating folders. Start by naming the domain facts.

When external architecture notes exist, copy them into a repo-local raw reference
folder and create an adapted current reference. In this repo, use:

- `architecture-samples/domain-slice-monorepo/docs/source-architecture/raw/`
- `architecture-samples/domain-slice-monorepo/docs/source-architecture/current/`

Use `current/` for implementation decisions. Use `raw/` only for traceability.

## 2. Data Schema Addition

Add schema only after deciding which model it serves:

| Schema | Owner | Purpose |
|---|---|---|
| write table | infrastructure/persistence | aggregate persistence |
| read model table | projector/BFF/read side | query latency/composition |
| event/outbox table | transaction boundary | reliable publish |
| metadata seed | governance | lineage, glossary, quality, cache policy |

## 3. Feature Implementation Order

1. command/query/event contract
2. identity/types/entity
3. repository/outbox/read-model ports
4. use case with transaction boundary
5. persistence/outbox adapters
6. presentation or BFF adapter
7. tests and logging assertions

## 4. OpenAPI Management

- Put public HTTP contract in contract package or OpenAPI fragment.
- Keep OpenAPI DTO separate from domain entity.
- Verify merged OpenAPI before treating the feature as done.
- If using `~/workflow/oa-sdk`, prefer its merge/check tool for contract composition.

## 5. Logging Spec Management

Define log fields before adding log statements:

- traceId, spanId, correlationId
- domain, useCase, aggregateId
- command/event name and version
- outcome, errorCode, retryCount
- cacheHit/cacheKeyPrefix when cache is involved

Logging must support tests and operations, not just local debugging.

## 6. CQRS, Cache, and Read Models

Classify each query:

- direct write-model query: allowed only for simple admin/internal lookups
- read model: denormalized data processing surface
- BFF model: UI composition surface
- cache: latency layer, not source of truth

Read model and BFF can share a table only if the UI composition is stable and documented.

## 7. Transaction API

Transaction boundary belongs to use case consistency:

- repository writes and outbox append must be atomic when business event is required
- idempotency must be part of command handling for retried writes
- transaction helper must be a port or application service contract, not an infrastructure leak

## 8. Scenario and Test Management

Use scenario docs when behavior spans multiple surfaces:

- Given: existing data/cache/event state
- When: command/query/API/event is performed
- Then: write model, read model, emitted event, log assertion, OpenAPI response

Prefer deterministic tests for domain/application and contract tests for API/BFF.
