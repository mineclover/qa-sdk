---
def:
  id: task-unit-1-async-worker
  type: knowledge
  knowledge_kind: guide
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: ingest-server
  tags: [runtime, task-record]
  links:
    - target: ingest-system
      type: traces_to
    - target: pipeline-system
      type: depends_on
sources:
  - packages/core/src/ports/task-queue.port.ts
  - packages/ingest-server/src/lib/bullmq-task-queue.ts
  - packages/ingest-server/src/lib/phase-two-worker.ts
  - packages/ingest-server/src/routes/ingest.ts
  - packages/ingest-server/src/async-worker.e2e.test.ts
  - packages/ingest-server/src/routes/dlq.ts
---

# Unit 1 — Phase 2 비동기 분리

> ingest-server의 Phase 2 (reconstruction + verdict)를 MQ Worker로 분리하여
> A2→A4 흐름을 구축하고, ingest 응답 지연을 해소한다.

## 목적 ^purpose

Unit 1 async worker task의 완료 위치를 추적한다. 현재 SSOT는 TaskQueue 포트, BullMQ/InMemory queue adapters, PhaseTwoWorker, ingest route wiring과 E2E 테스트다.

## 흐름 심볼

`[A2]` MQ Produce · `[A3]` MQ Buffer · `[A4]` MQ Consume

## 현재 상태

```
완료: POST /v1/ingest → [S1→S4 Phase 1] → 202
                                   ↘ [A2] MQ → [A3] Buffer → [A4] Worker
fallback: TaskQueue 미주입 시 기존 동기 Phase 2 경로 유지
```

| 단계 | 현재 | 구현 결과 |
|---|---|---|
| Phase 1 (저장) | ✅ 동기, 트랜잭션 | 변경 없음 |
| Phase 2 (reconstruction) | ✅ Worker job | sync fallback 유지 + trace 멱등 skip |
| Phase 2 (verdict) | ✅ Worker job | reconstruction 후 follow-up enqueue |
| DLQ | ✅ DB 기반 | worker final failure 기록 + admin retry 유지 |

## 선행 조건

없음 (첫 번째 Unit).

## MQ 선택지

| 옵션 | 장점 | 단점 | 적합 |
|---|---|---|---|
| **BullMQ (Redis)** | 경량, 즉시 도입, retry/delay 내장 | Redis 의존, 순서 보장 제한 | MVP, 단일 인스턴스 |
| **Kafka** | 순서 보장, replay, fan-out | 운영 복잡, 초기 설정 큼 | Unit 2 통합 시 |
| **SQS/Cloud Pub/Sub** | 관리형, 확장 무한 | 순서 보장 약함 | 클라우드 네이티브 |

**권장**: BullMQ로 시작 → Unit 2에서 Kafka 필요 시 전환.

## 작업 항목

| # | 작업 | 위치 | 설명 |
|---|---|---|---|
| 1 | MQ 포트 인터페이스 | `packages/core/src/ports/task-queue.port.ts` | `TaskQueue { enqueue(task), process(handler) }` 완료 |
| 2 | BullMQ 어댑터 | `packages/ingest-server/src/lib/bullmq-task-queue.ts` | standalone package 대신 package-local adapter로 완료 |
| 3 | Worker 서비스 | `packages/ingest-server/src/server.ts` | `node dist/server.js --mode worker` |
| 4 | ingest-server 변경 | `packages/ingest-server/src/routes/ingest.ts` | Phase 2 직접 호출 → `taskQueue.enqueue({ traceId, phase })` |
| 5 | DLQ 유지 | `packages/ingest-server/src/server.ts`, `src/routes/dlq.ts` | BullMQ final failure → DB DLQ → admin retry |
| 6 | 통합 테스트 | `packages/ingest-server/src/async-worker.e2e.test.ts` | 202 즉시 반환, worker consume, DLQ retry, latency 비교 |

## 설계 고려

- **Phase 1과 Phase 2 분리점**: `S4` (DB commit) 직후 `A2` (enqueue)
- **멱등성**: 같은 traceId를 중복 enqueue해도 reconstruction은 멱등 (이미 reconstructed면 skip)
- **순서**: trace 단위로 순서 보장 필요 없음 (각 trace 독립)
- **장애 시**: MQ 다운 → Phase 2 지연만 발생, Phase 1 데이터는 안전 (DB committed)

## 산출물

- TaskQueue 포트 인터페이스
- BullMQ 어댑터 (또는 선택한 MQ)
- Worker 서비스 (reconstruction + verdict)
- ingest-server Phase 2 분리
- A 흐름 커버리지: 14% → **57%** (A2, A3, A4, A7)
