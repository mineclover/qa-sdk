---
def:
  id: runtime-flow-paths
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  svc: qa-sdk-cli
  tags: [tier-system]
  links:
    - target: runtime-flows-spec
      type: refines
---

# 런타임 흐름 경로

## 목적 ^purpose

운영 시나리오를 동기 처리, 비동기 수집/집계, 실시간 디버깅 경로로 나눠 각 단계의 책임과 참여 모듈을 정리한다.

## 구성 ^overview

- `동기 처리 경로 (Phase 1)`: SDK → ingest → 저장의 동기 수집 파이프라인을 정의한다.
- `비동기 처리 경로 (Phase 2)`: 재구성/판정/집계의 비동기 후처리 파이프라인을 기술한다.
- `실시간 디버깅 경로`: WebSocket/gRPC 기반 실시간 스트림과 디버그 UI를 명시한다.
- `참여 모듈 맵`: 각 경로에서 사용하는 Store, Service, Worker의 역할 배분을 정리한다.

## 동기 처리 경로 (Phase 1)

SDK emit → ingest-server 수집 → 즉시 저장. 호출 응답에 필요한 최소 저장과 확인만 책임진다.

```
[SDK/Logger] → HttpTransport/ProtobufTransport
  → POST /v1/ingest
    → Zod 스키마 검증 (transmissionEnvelopeSchema)
    → enrichAddressContext(envelope, records)
    → RecordStore.insertBatch(records)
    → TraceStore.upsert(trace)
    → SessionStore.upsert(session)
    → RecordStreamBroker.publish(records) — 실시간 구독자에게 전파
    → 200 OK 응답
```

동기 경로의 store 참여: RecordStore, TraceStore, SessionStore, TransmissionStore, DlqStore(실패 시).
registry 검증 모드(strict/warn/off)에 따라 이벤트 키 유효성을 확인한다.

## 비동기 처리 경로 (Phase 2)

Phase 1 저장 완료 후 TaskQueue에 작업을 넣고, Worker가 비동기로 처리한다.

```
[Phase 1 완료] → TaskQueue.enqueue(reconstructionTask)
  → phase-two-worker.ts
    → TraceStore.findByTrace(traceId)
    → 재구성: 이벤트 순서 정렬 + ScenarioSpec 매칭
    → VerdictStore.save(verdict) — pass/fail/pending 판정
    → convergence-pipeline (선택): 메트릭 집계, 패턴 분류, 관측 생성
```

TaskQueue 구현체: InMemoryTaskQueue (개발), BullMQ (운영). convergence 실패가 Phase 2 verdict/활성화를 절대 차단하지 않는다(에러 격리).

## 실시간 디버깅 경로

운영자 관찰성과 문제 재현을 위한 별도 스트림:

| 채널 | 프로토콜 | 용도 |
|------|----------|------|
| `/v1/streams/records` | SSE | 실시간 레코드 스트림 (platform-demo 소비) |
| `/ws` | WebSocket | 양방향 디버그 (debug-ws.ts) |
| gRPC debug (port 50051) | gRPC | 고성능 디버깅 (GRPC_PORT 설정 시) |

- RecordStreamBroker가 Phase 1에서 저장된 레코드를 실시간으로 구독자에게 전파한다.
- DebugStore(InMemoryDebugStore)가 최근 레코드를 캐시하여 디버그 UI에서 조회 가능하게 한다.
- 디버깅 경로는 운영 데이터를 변경하지 않는다 (읽기 전용).

## 참여 모듈 맵

| 모듈 | Phase 1 (동기) | Phase 2 (비동기) | 디버깅 |
|------|----------------|------------------|--------|
| RecordStore | O (insertBatch) | O (조회) | — |
| TraceStore | O (upsert) | O (findByTrace) | — |
| SessionStore | O (upsert) | — | — |
| VerdictStore | — | O (save) | — |
| ScenarioSpecStore | — | O (매칭) | — |
| DlqStore | O (실패 시) | — | — |
| TaskQueue | O (enqueue) | O (dequeue) | — |
| RecordStreamBroker | O (publish) | — | O (subscribe) |
| DebugStore | — | — | O (캐시) |
| ConvergencePipeline | — | O (선택) | — |
