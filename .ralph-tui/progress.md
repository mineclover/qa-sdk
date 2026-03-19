# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- Shared ports belong in `packages/core/src/ports/*.port.ts` and are re-exported from `packages/core/src/index.ts`; package-local test adapters can live beside their consuming code (for example, `packages/ingest-server/src/lib/*`) when they are not yet shared across packages.
- `packages/ingest-server` 환경 변수를 늘릴 때는 `src/config/env.ts`만 바꾸지 말고 루트 `.env.example`, 루트 `.env`, 패키지 `.env.example`, `docker-compose.yml` passthrough까지 함께 맞춰서 Docker/로컬 실행 경로를 동시에 유지한다.
- `packages/ingest-server`에서 새 infra port를 도입할 때는 `AppDeps`에는 optional로 추가하고, 실제 활성화는 composition root(`src/server.ts`)에서 env gate로 결정한다. 이렇게 두면 `createApp()` 직접 호출 테스트와 non-queue 배포는 기존 동기 경로를 그대로 유지할 수 있다.
- MQ worker가 terminal failure와 DLQ 기록을 소유해야 할 때는 orchestration helper에 `captureFailuresInDlq: false` 같은 opt-out을 두고, queue adapter의 final-failure hook에서만 `DlqStore.insert()`를 호출한다. 이렇게 해야 BullMQ retry 중간 실패가 DLQ를 오염시키지 않는다.
- `InMemoryTaskQueue`처럼 테스트용 직렬 queue가 worker handler 내부에서 같은 queue로 후속 job을 다시 enqueue할 수 있다면, nested enqueue는 현재 handler completion을 기다리지 않도록 분리해야 deadlock이 나지 않는다.
- HTTP 서버용 Docker image를 worker 모드로 재사용할 때는 Compose에서 worker 서비스 healthcheck를 끄거나 worker 전용 probe로 바꿔야 한다. 기본 `/health/live` probe를 그대로 상속하면 비HTTP worker가 unhealthy로 남는다.
- 이 모노레포의 로컬 Compose 이미지는 `pnpm deploy --legacy --prod`보다 build stage의 전체 워크스페이스를 runtime stage로 복사하는 방식이 더 안정적이다. unrelated workspace package 하나가 deploy를 깨뜨려도 서비스용 dist와 workspace symlink는 그대로 실행된다.
- `InMemoryTaskQueue`로 reconstruction job이 같은 queue에 verdict job을 체인하면 `process()` 호출만으로는 최종 drain까지 기다리지 못할 수 있다. 테스트에서 terminal 상태를 검증할 때는 `taskQueue.close()` 등으로 execution chain이 비워질 때까지 명시적으로 기다린다.

---

## 2026-03-18 - US-001
- Implemented a new `TaskQueue` port in `@qa-sdk/core` with `TaskPayload`, `TaskPhase`, `TaskQueueOptions`, and `TaskHandler` types. The port keeps point-to-point queue semantics explicit and reserves fan-out for a future separate `EventBus` contract.
- Added `InMemoryTaskQueue` in `packages/ingest-server` for tests. It buffers tasks until `process()` is registered, executes enqueued tasks immediately once a handler exists, simulates retry attempts with optional delay, and rejects new work after `close()`.
- Added unit tests covering enqueue→process round-trip, retry simulation after a transient handler failure, and enqueue rejection after close.
- Files changed:
  - `packages/core/src/ports/task-queue.port.ts`
  - `packages/core/src/index.ts`
  - `packages/ingest-server/src/lib/in-memory-task-queue.ts`
  - `packages/ingest-server/src/lib/in-memory-task-queue.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Ports are centralized in `@qa-sdk/core`, while in-memory or package-specific adapters can stay local until a second consumer appears.
  - `packages/ingest-server` tests rely on `@qa-sdk/core` exports, so local verification needs a `core` build first to refresh ignored `dist/` artifacts.
---

## 2026-03-18 - US-002
- Implemented `BullMQTaskQueue` in `packages/ingest-server` as a `TaskQueue<TaskPayload>` adapter with Redis URL parsing, `traceId`-based `jobId` dedupe, configurable worker concurrency, BullMQ retry/backoff option mapping, worker error logging, and graceful `close()` handling for queue/worker shutdown.
- Added ingest-server env support for required `REDIS_URL` and defaulted `WORKER_CONCURRENCY=5`, then mirrored the new settings into local `.env` files, root Compose env, and `docker-compose.yml` with a new Redis service dependency.
- Added unit tests covering enqueue→process flow, pre-registration queue draining, retry/backoff option mapping, graceful shutdown, and Redis connection failure logging. Verified with `pnpm --filter @qa-sdk/core build`, `pnpm --filter @qa-sdk/ingest-server build`, and `pnpm --filter @qa-sdk/ingest-server test`.
- Files changed:
  - `packages/ingest-server/src/lib/bullmq-task-queue.ts`
  - `packages/ingest-server/src/lib/bullmq-task-queue.test.ts`
  - `packages/ingest-server/src/config/env.ts`
  - `packages/ingest-server/src/config/env.test.ts`
  - `packages/ingest-server/package.json`
  - `packages/ingest-server/.env.example`
  - `packages/ingest-server/.env`
  - `.env.example`
  - `.env`
  - `docker-compose.yml`
  - `README.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - BullMQ-specific runtime loading can be kept behind a local adapter boundary with injected module fakes in tests, which avoids coupling package-wide tests to a live Redis instance.
  - Mapping `TaskQueueOptions.retryAttempts` to BullMQ needs `attempts = retryAttempts + 1`, because BullMQ counts the initial execution in `attempts`.
  - **Gotchas encountered**
  - The sandbox blocks `pnpm add`/lockfile updates because the configured pnpm store lives outside writable roots, so `packages/ingest-server/package.json` was updated manually and build/test verification relied on lazy runtime import plus injected BullMQ fakes.
---

## 2026-03-18 - US-003
- Split ingest Phase 2 out of `routes/ingest.ts` by moving reconstruction + verdict orchestration into a shared `phase-two-worker` helper, so `/v1/ingest` now persists Phase 1 data, enqueues `{ traceId, phase: "reconstruction" }` tasks when a `TaskQueue` is injected, and returns `202` without waiting for Phase 2 work.
- Added optional `taskQueue` wiring to `AppDeps`/`IngestDeps`, gated BullMQ worker startup behind `TASK_QUEUE_ENABLED`, registered the queue worker in `src/server.ts`, and preserved the existing synchronous fallback when the queue is disabled or not injected.
- Added queue-path coverage in `routes/ingest.test.ts` and an end-to-end in-memory queue flow in `app.test.ts` that verifies enqueue → worker process → reconstruct → verdict using `InMemoryTaskQueue`.
- Files changed:
  - `packages/ingest-server/src/lib/phase-two-worker.ts`
  - `packages/ingest-server/src/routes/ingest.ts`
  - `packages/ingest-server/src/routes/ingest.test.ts`
  - `packages/ingest-server/src/app.ts`
  - `packages/ingest-server/src/app.test.ts`
  - `packages/ingest-server/src/server.ts`
  - `packages/ingest-server/src/config/env.ts`
  - `packages/ingest-server/src/config/env.test.ts`
  - `packages/ingest-server/.env.example`
  - `packages/ingest-server/.env`
  - `.env.example`
  - `.env`
  - `docker-compose.yml`
  - `README.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - The cleanest way to preserve backward compatibility was to keep queue awareness at the composition root and let the ingest route branch only on whether `taskQueue` was injected.
  - `InMemoryTaskQueue` is best used for async-route integration tests by enqueueing before `process()` registration; once a handler is registered, `enqueue()` resolves only after the handler finishes, which would otherwise mask the intended `202`-before-Phase-2 behavior.
  - **Gotchas encountered**
  - Tightening the local ingest route test helper to `Partial<IngestTestDeps>` surfaced missing registry override types; the helper interface has to include those optional route-only deps or the package build fails even though Vitest still runs.
---

## 2026-03-18 - US-004
- Implemented `--mode worker` runtime support in `packages/ingest-server/src/server.ts`, splitting HTTP server bootstrap from queue-consumer bootstrap so the same image can run as an ingest API or as a dedicated BullMQ worker.
- Reworked `phase-two-worker` into trace-scoped jobs: reconstruction jobs target a single trace, skip already reconstructed traces, automatically enqueue a follow-up verdict job, and rethrow single-trace failures so BullMQ retry semantics actually apply.
- Added BullMQ final-failure handling with phase-aware job IDs (`reconstruction:traceId`, `verdict:traceId`) and DB DLQ recording only after retries are exhausted, while keeping synchronous/orchestration paths on the existing DLQ behavior.
- Added worker runtime mode parsing, worker shutdown handling, queue reentrancy fixes for the in-memory test queue, docker-compose worker service wiring, and new tests covering worker chaining, idempotent reconstruction skip, final-failure hooks, and `--mode worker` shutdown flow.
- Files changed:
  - `packages/engine/src/orchestration/reconstruct-pending-traces.ts`
  - `packages/engine/src/orchestration/reconstruct-pending-traces.test.ts`
  - `packages/engine/src/orchestration/compute-pending-verdicts.ts`
  - `packages/engine/src/orchestration/compute-pending-verdicts.test.ts`
  - `packages/ingest-server/src/server.ts`
  - `packages/ingest-server/src/routes/ingest.ts`
  - `packages/ingest-server/src/routes/ingest.test.ts`
  - `packages/ingest-server/src/lib/phase-two-worker.ts`
  - `packages/ingest-server/src/lib/phase-two-worker.test.ts`
  - `packages/ingest-server/src/lib/bullmq-task-queue.ts`
  - `packages/ingest-server/src/lib/bullmq-task-queue.test.ts`
  - `packages/ingest-server/src/lib/in-memory-task-queue.ts`
  - `packages/ingest-server/src/lib/runtime-mode.ts`
  - `packages/ingest-server/src/lib/runtime-mode.test.ts`
  - `packages/ingest-server/src/lib/worker-shutdown.ts`
  - `packages/ingest-server/src/lib/worker-shutdown.test.ts`
  - `docker-compose.yml`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Reconstruction/verdict worker jobs need targeted orchestration helpers that can suppress inline DLQ writes; otherwise BullMQ retries and DB DLQ semantics fight each other.
  - Reusing one queue for reconstruction and verdict requires phase-aware `jobId`s; trace-only dedupe collides as soon as the reconstruction handler enqueues the verdict follow-up job.
- **Gotchas encountered**
  - The old `InMemoryTaskQueue` deadlocked when a handler enqueued another job on the same queue because `enqueue()` awaited the chained execution promise from inside the currently running handler; nested enqueues had to be detached while still preserving the original await-on-enqueue behavior for non-reentrant callers.
---

## 2026-03-18 - US-005
- Aligned root Compose queue settings with the runtime env names expected by `packages/ingest-server`: `REDIS_URL`, `TASK_QUEUE_ENABLED`, and `WORKER_CONCURRENCY` are now documented in the root `.env.example` and passed through directly to both `ingest-server` and the dedicated `worker` service.
- Kept Redis on `redis:7-alpine` with host port `6379`, renamed the dedicated worker service to `worker`, kept it on the same ingest image with `node dist/server.js --mode worker`, and disabled the inherited HTTP healthcheck so the non-HTTP worker stays healthy under Compose.
- Fixed local `docker compose up --build` bring-up by simplifying both service Dockerfiles to copy the built workspace from the build stage instead of using `pnpm deploy --legacy --prod`, which was failing on unrelated workspace packages during image assembly.
- Verified with `pnpm --filter @qa-sdk/ingest-server... run build`, `pnpm --filter @qa-sdk/core test`, `pnpm --filter @qa-sdk/engine test`, `pnpm --filter @qa-sdk/ingest-server test`, and `docker compose up --build -d` followed by `docker compose ps`/logs for `postgres`, `redis`, `registry-server`, `ingest-server`, and `worker`.
- Files changed:
  - `docker-compose.yml`
  - `.env.example`
  - `.env`
  - `README.md`
  - `Dockerfile.ingest-server`
  - `Dockerfile.registry-server`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - Compose worker services that reuse an HTTP image need an explicit healthcheck override or they will stay unhealthy even when the worker process is fine.
  - Local Docker packaging in this monorepo is more reliable when the runtime image copies the already-built workspace, because `pnpm deploy` can traverse unrelated workspace packages and fail on issues outside the target service.
  - Gotchas encountered
  - Renaming the root Compose variables from `INGEST_*` to runtime-facing names requires syncing the ignored root `.env` as well as `.env.example`; otherwise `docker compose up` silently falls back to blank values on the local machine.
---
## 2026-03-18 - US-006
- Added `packages/ingest-server/src/async-worker.e2e.test.ts` to verify the async Phase 2 path end-to-end: `POST /v1/ingest` returns `202` before worker processing, the worker completes reconstruction + verdict, worker final failure records to DLQ, and `POST /v1/admin/dlq/retry` recovers the trace successfully.
- Added an ingest latency comparison in the new acceptance test that logs before/after timings for inline Phase 2 versus queued Phase 2, so the response-time improvement remains regression-tested.
- Updated runtime/task planning docs to mark A2/A3/A4 and Unit 1 complete, and documented that the planned standalone `task-queue-bullmq` package was absorbed into the `ingest-server` package-local adapter.
- Files changed:
  - `packages/ingest-server/src/async-worker.e2e.test.ts`
  - `docs/specs/operations/runtime-flows.spec.md`
  - `docs/specs/tasks/README.md`
  - `docs/specs/tasks/unit-1-async-worker.md`
  - `docs/specs/spec.todo.md`
  - `docs/specs/todo-plan.md`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - Queue-backed acceptance tests can exercise real retry/final-failure ownership without Redis by injecting a fake BullMQ module into `BullMQTaskQueue` while keeping real stores and worker orchestration.
  - Chained in-memory queue jobs need an explicit drain point in tests because `process()` registration alone does not guarantee downstream follow-up jobs have finished.
  - Gotchas encountered
  - `TransmissionEnvelope.build.env` only accepts `local | dev | staging | production`; using `test` in fixtures fails schema validation and returns `400` before the async path is exercised.
---
