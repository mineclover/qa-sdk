---
def:
  id: system-data-flow
  address: def_document:v1:1073
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [tier-system]
  links:
    - target: ingest-api-spec
      type: refines
    - target: browser-monitor-spec
      type: refines
---
# 데이터 흐름

## 목적 ^purpose

이벤트가 브라우저/서버에서 발생하여 ingest → 저장 → 재구성 → 판정 → 시각화되는 전체 데이터 흐름.

## 구성 ^overview

- `1단계 SDK emit`: QaLogger/browser-sdk에서 이벤트를 생성하고 TransmissionEnvelope로 묶어 전송하는 흐름을 정의한다.
- `2단계 ingest 수집`: ingest-server에서 envelope을 수신, 검증, address_context 머지하는 흐름을 기술한다.
- `3단계 Phase 1 저장`: RecordStore/TraceStore/SessionStore에 동기 저장하는 흐름을 명시한다.
- `4단계 Phase 2 재구성/판정`: 비동기 worker에서 재구성, ScenarioSpec 매칭, verdict 판정하는 흐름을 정리한다.
- `5단계 시각화`: platform-demo/viz-web에서 SSE 스트림과 API로 데이터를 소비하는 흐름을 기술한다.

## 1단계: SDK emit

이벤트 생산자(QaLogger, browser-sdk)가 EventRecord를 생성하고 TransmissionEnvelope로 묶어 전송한다.

```
[QaLogger.log/startSpan/metric]
  → EventRecord 생성 (log_id, timestamp, trace_id, span_id, event_key, payload, address_context)
  → 내부 버퍼에 추가
  → batchSize 도달 또는 flushInterval → flush()
    → buildEnvelope(records) — owner, source, runtime, build, infra_context 포함
    → Transport.send(envelope) — HTTP JSON / Protobuf / QAPB
```

**address_context 부착 시점**: record 생성 시 직접 지정하거나, QaLoggerConfig.infraContext로 envelope 전체에 기본 좌표를 설정한다.

## 2단계: ingest 수집

ingest-server (포트 3200)가 envelope을 수신한다.

```
POST /v1/ingest
  → Content-Type 감지: JSON / QAPB / Protobuf
  → Zod transmissionEnvelopeSchema 검증
  → enrichAddressContext(envelope, records) — infra_context를 각 record에 머지
  → registry 검증 (strict/warn/off) — 이벤트 키 유효성
  → checkAddressHealth() — orphan prefix, stale version 탐지 (fail-open)
```

전송 프로토콜 자동 감지: QAPB magic(0x51 0x41 0x50 0x42) 있으면 QAPB, 없으면 Content-Type으로 판별.

## 3단계: Phase 1 저장

동기 경로에서 즉시 저장한다.

| Store | 저장 내용 | 드라이버 |
|-------|-----------|----------|
| RecordStore | 개별 EventRecord | memory/d1/pg/clickhouse |
| TraceStore | trace_id 단위 집계 | memory/d1/pg |
| SessionStore | qa_session_id 단위 | memory/d1/pg |
| TransmissionStore | envelope 메타데이터 | memory |
| DlqStore | 실패한 레코드 | memory |

저장 완료 후 RecordStreamBroker.publish(records)로 실시간 구독자에게 전파한다. TaskQueue에 Phase 2 작업을 enqueue한다.

## 4단계: Phase 2 재구성/판정

비동기 worker (phase-two-worker.ts)가 처리한다.

```
TaskQueue.dequeue(reconstructionTask)
  → TraceStore.findByTrace(traceId) — trace의 모든 record 조회
  → 이벤트 순서 정렬 (timestamp 기반)
  → ScenarioSpec 매칭 — 정상 흐름과 비교
  → VerdictStore.save(verdict) — pass/fail/pending 판정
  → [선택] convergence-pipeline — 메트릭 집계, 패턴 분류, 관측 생성
```

convergence 실패가 verdict를 차단하지 않는다(에러 격리). Phase 2에서 생성된 verdict는 insights API로 조회 가능하다.

## 5단계: 시각화

platform-demo (포트 5176)와 viz-web이 데이터를 소비한다.

| 소비 경로 | 프로토콜 | 데이터 소스 |
|-----------|----------|-------------|
| 실시간 모니터 | SSE /v1/streams/records | RecordStreamBroker |
| 대시보드 | REST /api/dashboard/metrics | registry-service |
| 다이어그램 | REST /api/diagrams | DKG graph |
| 인사이트 | REST /v1/insights/* | ingest-server |
| 이벤트 조회 | REST /v1/records | RecordStore |

모든 단계에서 address_context(좌표)가 이벤트에 부착되어, 시각화 시 3D 좌표 공간에서 이벤트의 위치를 결정한다.
