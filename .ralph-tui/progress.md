# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- Hono route modules can be unit tested by mounting them on a throwaway `Hono` instance and calling `app.request()`, which avoids booting the full server or wiring a database for route-local behavior.
- Drizzle Kit config runs outside the app's normal env parsing and is evaluated as CommonJS, so load `DATABASE_URL` directly inside `drizzle.config.ts` using `process.cwd()`-relative file reads instead of `import.meta`.
- In the `packages/registry-server` NodeNext setup, local ESM imports inside tests should keep the runtime `.js` specifier form (for example `../../lib/id.js`) even though the source files are TypeScript.
- Zod schema unit tests fit the codebase best as direct `parse()` and `safeParse()` assertions with table-driven invalid cases, which gives broad validation coverage without route harnesses or mocks.
- Service-layer business logic is cleanest to unit test by instantiating the class with a `vi.fn()` repository double and asserting the translated DTO shape plus the exact repository patch payload.
- When a service creates a repository inside `db.transaction()`, mock the repository module constructor to return the transaction-scoped double and have `db.transaction()` pass that same double into the callback; this isolates transaction flow without mocking Drizzle internals.
- Global Hono error middleware can be covered end-to-end by mounting throwaway routes that deliberately raise each error type and asserting the normalized JSON from `app.request()`.
- Integration tests against the real Postgres service can stay reusable by loading `.env.test` inside a helper, applying the generated Drizzle migration SQL once with `postgres.js`, and truncating tables between tests instead of recreating the schema.
- CRUD endpoint integration tests fit the codebase best when they reuse one `createTestApp()` instance, call `cleanupDb()` in `beforeEach`, and seed/assert entirely through small `app.request()` JSON helpers so response shapes stay aligned with the public API.
- Nested integration endpoint tests stay aligned with the public contract when `beforeEach` seeds the parent resource through the API once and child request helpers default to that returned parent ID/name.
- Real-DB integration specs that truncate shared tables must run with Vitest file parallelism disabled, otherwise separate test files can delete each other's seeded rows mid-test.
- Advisory-lock integration tests for versioned resources are most reliable when they fire concurrent `app.request()` POSTs with `Promise.all()`, then sort both returned and persisted versions before asserting the exact sequence because lock acquisition order is nondeterministic.

---

## 2026-03-12 - US-001
- What was implemented
  - Added Vitest scripts and devDependencies for the `@qa-sdk/registry-server` package.
  - Added `vitest.config.ts` with Node test environment, coverage config, and a source alias.
  - Added `docker-compose.yml` with a PostgreSQL 16 test database on host port `5433`.
  - Added a placeholder `src/__tests__/health.test.ts` that verifies `GET /health` returns `{ ok: true }` using `app.request()`.
- Files changed
  - `packages/registry-server/package.json`
  - `packages/registry-server/vitest.config.ts`
  - `packages/registry-server/docker-compose.yml`
  - `packages/registry-server/src/__tests__/health.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Route-only Hono tests can avoid `createApp()` when the endpoint has no dependency requirements.
  - Gotchas encountered
    - `createApp()` requires a real `Db`, so the placeholder health check is cleaner as a mounted route test instead of a full app test.
    - The sandbox had no registry access for `pnpm install`, so local offline package links were used to verify `typecheck`, `test`, and `test:coverage`.
---
## 2026-03-12 - US-002
- What was implemented
  - Added env file loading to `drizzle.config.ts` so `drizzle-kit generate` can read `DATABASE_URL` from `.env.local` or `.env`, with a generate-only fallback to `.env.example`.
  - Generated the initial Drizzle migration SQL and metadata for the `services` and `service_events` schema.
  - Verified `pnpm --filter @qa-sdk/registry-server db:generate` and `pnpm --filter @qa-sdk/registry-server typecheck`.
- Files changed
  - `packages/registry-server/drizzle.config.ts`
  - `packages/registry-server/drizzle/0000_cloudy_rocket_racer.sql`
  - `packages/registry-server/drizzle/meta/0000_snapshot.json`
  - `packages/registry-server/drizzle/meta/_journal.json`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Drizzle migration generation needs its own config-time env loading; relying on the runtime `env.ts` parser does not help `drizzle-kit`.
  - Gotchas encountered
    - `drizzle-kit generate` still expects `dbCredentials.url` to be present even though it generates from the schema without connecting to PostgreSQL.
    - `drizzle-kit` evaluates `drizzle.config.ts` as CommonJS, so `import.meta.dirname` breaks and `process.cwd()` is the safer base path.
---
## 2026-03-12 - US-003
- What was implemented
  - Added unit tests for shared lib utilities covering version incrementing and overflow, generated service and event IDs, application error helpers, and the clock helper.
- Files changed
  - `packages/registry-server/src/__tests__/lib/version.test.ts`
  - `packages/registry-server/src/__tests__/lib/id.test.ts`
  - `packages/registry-server/src/__tests__/lib/errors.test.ts`
  - `packages/registry-server/src/__tests__/lib/clock.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Small shared lib modules can be covered with direct unit tests and no harness beyond Vitest, which keeps test startup and assertions simple.
  - Gotchas encountered
    - The package uses NodeNext module resolution, so test imports must use `.js` specifiers for local modules.
---
## 2026-03-12 - US-004
- What was implemented
  - Added direct Vitest coverage for `createServiceSchema` and `updateServiceSchema`, including valid create input, `service_name` edge cases, display/description limits, empty update rejection, partial updates, and status enum validation.
  - Added matching coverage for `createEventSchema` and `updateEventSchema`, including `event_key` edge cases plus `record_kind` enum acceptance and defaulting to `"log"`.
  - Verified `pnpm --filter @qa-sdk/registry-server test` and `pnpm --filter @qa-sdk/registry-server typecheck`.
- Files changed
  - `packages/registry-server/src/__tests__/modules/services/service.schema.test.ts`
  - `packages/registry-server/src/__tests__/modules/events/event.schema.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Schema-only validation is fastest to cover with direct Zod unit tests that assert successful normalization via `parse()` and failures via `safeParse()`.
  - Gotchas encountered
    - The new tests still need NodeNext-style `.js` import specifiers even though they import TypeScript source modules.
---
## 2026-03-12 - US-005
- What was implemented
  - Added mocked repository unit tests for `ServiceService` covering `create`, `getByName`, `getById`, and `update` success and not-found/conflict paths.
  - Verified generated `svc_` IDs, repository delegation, DTO field mapping, and partial update payload handling.
- Files changed
  - `packages/registry-server/src/__tests__/modules/services/service.service.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Service-layer tests can stay fully isolated by letting mocked repository methods echo row-shaped fixtures, which makes ID generation and DTO mapping assertions straightforward.
  - Gotchas encountered
    - `ServiceService` depends on the concrete `ServiceRepository` class, so the repository double needs a cast even though only `findByName`, `findById`, `insert`, and `update` are used.
---
## 2026-03-12 - US-006
- What was implemented
  - Added mocked `EventService` unit tests covering transactional `create()` version assignment, advisory-lock ordering, service/event not-found paths, version overflow, version listing, version lookup, and update behavior.
  - Verified the transaction mock by routing `db.transaction()` through a repo-shaped callback double while keeping `EventRepository`, `ServiceRepository`, and `Db` fully mocked.
- Files changed
  - `packages/registry-server/src/__tests__/modules/events/event.service.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Transaction-scoped repository creation can be unit tested cleanly by mocking the repository constructor itself and letting the transaction callback receive the same repo-shaped double.
  - Gotchas encountered
    - Strict TypeScript typing on `vi.fn()` transaction mocks is easier to keep stable when the mock is inferred locally and only cast at the `Db` injection boundary.
---
## 2026-03-12 - US-007
- What was implemented
  - Added end-to-end middleware tests for the global `errorHandler` using a local `Hono` app with routes that deliberately throw `AppError`, `ZodError`, and generic `Error` instances.
  - Verified the JSON response format, status codes, Zod path formatting, and the generic 500 response sanitization behavior.
- Files changed
  - `packages/registry-server/src/__tests__/middleware/error-handler.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Error middleware is easiest to validate by exercising the real `app.onError()` path through throwaway routes instead of calling the handler as a plain function.
  - Gotchas encountered
    - Zod's validation text can vary, so the stable assertion point is the joined field path fragments in the formatted `INVALID_INPUT` message.
---
## 2026-03-12 - US-008
- What was implemented
  - Added `src/__tests__/helpers/setup.ts` with reusable `createTestDb()`, `cleanupDb()`, and `createTestApp()` helpers plus `closeTestDb()` for test shutdown.
  - Added `.env.test` pointing at the Docker PostgreSQL instance on port `5433` and wired the helper to load `DATABASE_URL` from the environment first or from that file.
  - Made the DB client cache URL-aware so test and non-test connections do not share a single singleton client.
  - Added `src/__tests__/integration/smoke.test.ts` to verify PostgreSQL connectivity, schema presence, and `GET /health` on the real app.
  - Verified `pnpm --filter @qa-sdk/registry-server typecheck` locally and re-ran `test` plus `typecheck` from a clean Dockerized Node environment on the Postgres network because the host sandbox blocks localhost DB sockets.
- Files changed
  - `packages/registry-server/src/db/client.ts`
  - `packages/registry-server/src/__tests__/helpers/setup.ts`
  - `packages/registry-server/src/__tests__/integration/smoke.test.ts`
  - `packages/registry-server/.env.test`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Real-DB integration tests are easiest to keep deterministic by applying the generated migration SQL once and truncating the small table set between tests.
  - Gotchas encountered
    - The local sandbox denies Node connections to `127.0.0.1:5433` with `EPERM`, so Docker-networked verification is the reliable fallback for DB-backed tests here.
    - The workspace lockfile is stale relative to `packages/registry-server/package.json`, so a clean verification install needs `pnpm install --no-frozen-lockfile` until the lockfile is refreshed.
---
## 2026-03-12 - US-009
- What was implemented
  - Added `src/__tests__/integration/services.test.ts` covering `POST /services`, `GET /services/:serviceName`, and `PATCH /services/:serviceId` against the real PostgreSQL-backed app.
  - Covered success cases for create, fetch, display name update, and status deprecation, plus conflict, validation, missing-field, empty-patch, and not-found error responses.
  - Reused the US-008 test helpers with `beforeEach(cleanupDb)` so the `services` and `service_events` tables are truncated before every test.
- Files changed
  - `packages/registry-server/src/__tests__/integration/services.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Service endpoint integration specs stay concise when common JSON request helpers seed records through `POST /services` and later assertions reuse the returned API payloads.
  - Gotchas encountered
    - Hono serializes the service timestamp fields as ISO strings, so integration assertions need to compare parsed dates rather than `Date` instances.
    - Host-side `pnpm --filter @qa-sdk/registry-server test` still fails with `EPERM` on `localhost:5433`, so real-DB verification remains Docker-network-only in this environment.
---
## 2026-03-12 - US-010
- What was implemented
  - Added `src/__tests__/integration/events.test.ts` covering event creation, per-key auto-versioning, version listing, version lookup, and patch updates against the real PostgreSQL-backed app.
  - Seeded a parent service in `beforeEach` through `POST /services` and reused that parent across the child event endpoint assertions.
- Files changed
  - `packages/registry-server/src/__tests__/integration/events.test.ts`
  - `packages/registry-server/vitest.config.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Nested resource integration tests are cleanest when the parent resource is created once in `beforeEach` through the public API and child helpers default to that seeded parent.
  - Gotchas encountered
    - Event lookup responses include ISO timestamp strings and the version-detail route adds `service_name`, so assertions need route-specific response types instead of reusing the raw service-layer types.
    - Vitest's default file-level parallelism races the shared Postgres truncation strategy, so the registry-server suite needs `fileParallelism: false` for deterministic integration runs.
---
## 2026-03-12 - US-011
- What was implemented
  - Added `src/__tests__/integration/concurrency.test.ts` to verify advisory-lock-backed event version creation under concurrent `POST /services/:serviceId/events` requests.
  - Covered 5 simultaneous same-key creates and 3+3 simultaneous split-key creates, asserting independent sequential version assignment and persisted uniqueness.
- Files changed
  - `packages/registry-server/src/__tests__/integration/concurrency.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Advisory-lock concurrency coverage is strongest when the test validates both the response payload versions and the persisted row versions for the same `(service_id, event_key)` scope.
  - Gotchas encountered
    - `Promise.all()` preserves the original promise order, not the advisory-lock acquisition order, so the returned `event_version` values need to be sorted before asserting the expected sequence.
---
