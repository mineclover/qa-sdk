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

## 1.5. Slice Topology Decision

`metadata/openmetadata.seed.json` 의 top-level `topology` 필드를 결정 — 5 위상 중 하나. validator 가 위상별로 룰을 분기한다.

| 질문 | 위상 |
|---|---|
| 쓰기 명령 + aggregate 정상 | `service` |
| 쓰기 명령 + aggregate 없음 (예: authenticate) | `command-only` |
| 본체가 query/projection (admin write 분리) | `read-model` |
| `presentation/bff/*` 합성 controller | `bff` |
| cache/lookup/issuer 위주 (예: bitmap) | `read-mostly` |

상세 + 룰 분기 표 + 안티 패턴: `topology-taxonomy.md`.

## 2. Data Schema Addition

Add schema only after deciding which model it serves:

| Schema | Owner | Purpose |
|---|---|---|
| write table | infrastructure/persistence | aggregate persistence |
| read model table | projector/BFF/read side | query latency/composition |
| event/outbox table | transaction boundary | reliable publish |
| metadata seed | governance | lineage, glossary, quality, cache policy, **topology** |

### Service-Shared Outbox

각 서비스가 단일 `<svc>_outbox_events` 테이블 (snake_case 컬럼: `aggregate_id`, `event_name`, `event_version`, `payload`, `occurred_at`, `scope_id`, `status` — kit 컨벤션).

슬라이스의 `infrastructure/outbox/<slice>.outbox.ts` 가 service-shared schema 의 dialect 별 table (`sqlite/schema.js`, `pg/schema.js`) 을 직접 import 해 kit `createDrizzleOutboxPort({ db, table })` 에 전달. alias re-export 금지 (drift 방지).

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
