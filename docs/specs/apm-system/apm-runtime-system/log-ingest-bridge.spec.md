---
def:
  id: log-ingest-bridge
  scope: constraint
  aspect: infra_constraint
  depth: specification
  level: module
  tier: system
  lifecycle: approved
  layer: operation
  svc: logger
  tags: [logging, ingest, transport]
  links:
    - target: logger-contract
      type: contains
    - target: runtime-flow-paths
      type: contains
    - target: log-ingest-forwarder
      type: contains
    - target: log-ingest-wiring
      type: contains
defines:
  - IngestForwarder
  - createIngestForwarder
  - LogIngestBridgeConfig
  - createMultiDestination
  - ForwarderStats
consumes:
  - "@qa-sdk/core :: EventRecord, TransmissionEnvelope, newLogId, newTransmissionId, newTraceId, newSpanId, now"
  - "@qa-sdk/core :: createLogger (destinations 옵션)"
  - "ingest-server :: POST /v1/ingest"
---

# Log → Ingest Bridge

## 목적 ^purpose

pino 구조화 로그 중 좌표 데이터(`addressContext`)를 포함한 로그만 필터링하여 ingest 파이프라인에 `EventRecord`로 전달하는 브릿지. 서비스 로그와 좌표 수집을 단일 `logger.info()` 호출로 통합한다.

## 구성 ^overview

^delegates

- `log-ingest-forwarder`: IngestForwarder 구현 상세 — 필터, 변환, 버퍼링, fail-open, 진단 통계.
- `log-ingest-wiring`: 서비스 배선 패턴 — createLogger 확장, lib/logger.ts 공용 패턴, 좌표 주입 패턴.

## 데이터 흐름

```
서비스 코드
  │
  logger.info({ addressContext: { service: "service:v1:42" } }, "요청 처리")
  │
  pino (createMultiDestination)
  ├─ primary: stdout (기존, 운영 로그 — 모든 로그)
  └─ extra[0]: IngestForwarder (level: "info")
       │
       ├─ 1. Filter: addressContext 키 존재?
       ├─ 2. Transform: pino log → EventRecord
       ├─ 3. Buffer: ring buffer (max 500, batch 50)
       ├─ 4. Flush: batchSize 도달 or flushInterval(5s)
       └─ 5. Send: POST /v1/ingest (fail-open)
```

## 의존 방향

```
서비스 (lib/logger.ts)
  ├── @qa-sdk/core     (createLogger)
  └── @qa-sdk/logger   (createIngestForwarder)

@qa-sdk/logger → @qa-sdk/core  (기존, 방향 유지)
@qa-sdk/core ←✗ @qa-sdk/logger  (역방향 금지)
```

순환 방지: `createLogger`는 generic `Destination { write(msg: string): void }`만 받는다.

## 코드 위치

| 파일 | 정의 | 역할 |
|------|------|------|
| `packages/logger/src/transport/ingest-forwarder.ts` | `IngestForwarder`, `createIngestForwarder`, `LogIngestBridgeConfig`, `ForwarderStats` | pino Destination → ingest HTTP 전송 |
| `packages/core/src/lib/create-logger.ts` | `createMultiDestination`, `CreateLoggerOptions`, `LoggerDestination` | stdout + extras 동시 write |
| `packages/*/src/lib/logger.ts` | 서비스별 `createLogger` 래퍼 | QA_INGEST_ENDPOINT 조건부 활성화 |
