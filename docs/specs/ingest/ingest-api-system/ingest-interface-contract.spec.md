---
def:
  id: ingest-interface-contract
  address: def_document:v2:412816
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: ingest-server
  tags: [entry-point, contract, runtime]
  links:
    - target: ingest-api-system
      type: refines
    - target: transmission-spec
      type: depends_on
---

# Ingest 인터페이스 계약

## 목적 ^purpose

SDK가 보내는 Transmission Envelope을 수신하는 ingest 엔드포인트의 입력, 응답, 저장 의존 계약을 분리해 정리한다.

## 구성 ^overview

- **POST /v1/ingest** — SDK의 TransmissionEnvelope을 수신하여 Phase 1 저장 후 202 응답.
- **Content-Type 자동 감지** — JSON, QAPB(레거시), 진짜 Protobuf, MessagePack 4종 지원.
- **Phase 1 (동기)** — transmission 메타 + trace/session/record 저장 + SSE 발행.
- **Phase 2 (비동기)** — reconstruction + verdict 계산 (인라인 또는 BullMQ).

## 엔드포인트 계약

### POST /v1/ingest

**요청:**

TransmissionEnvelope 형태의 body. `transmissionEnvelopeSchema` (zod)로 검증.

| Content-Type | 처리 |
|:---|:---|
| `application/json` (기본) | JSON.parse |
| `application/x-protobuf` + QAPB magic (0x51414042) | `fromProtoEnvelope` (레거시 QAPB) |
| `application/x-protobuf` (magic 없음) | `@qa-sdk/codec-proto` decodeEnvelope |
| `application/msgpack` | @msgpack/msgpack decode |

**응답 (성공):**

```json
{
  "accepted": true,
  "record_count": 5
}
```

HTTP 202 Accepted. 동기 저장(Phase 1) 성공을 의미하며, Phase 2 처리는 별도 진행.

**응답 (실패):**

| HTTP | 조건 |
|------|------|
| 400 | envelope schema 검증 실패, registry strict 모드 위반 |
| 429 | rate-limit 초과 |
| 503 | shutdown 중 (middleware가 차단) |

## 입력 데이터 흐름

```
SDK → POST /v1/ingest (Envelope)
  → deserializeEnvelope (Content-Type 감지)
  → transmissionEnvelopeSchema.parse (zod 검증)
  → enrichAddressContext (infra_context ← record.address_context 머지)
  → checkAddressHealth (orphan prefix / stale version 경고)
  → validateEnvelopeRecords (registry 검증 — strict/warn/off)
  → storeEnvelope (Phase 1)
```

## TransmissionEnvelope 구조

| 필드 | 설명 |
|------|------|
| `transmission_id` | 전송 고유 ID |
| `sent_at` | 전송 시각 |
| `owner` | { owner_type, owner_id } |
| `source` | { service_name, sdk_name, sdk_version } |
| `runtime` | { platform } |
| `build` | { env } |
| `records` | RecordInsert 배열 |

## Registry 검증 모드

| 모드 | 동작 |
|------|------|
| `strict` | 미등록 이벤트 → 400 에러 (envelope 전체 거부) |
| `warn` (기본) | 미등록 이벤트 → warning 로그 + registryWarning 필드 기록. 저장은 진행 |
| `off` | 검증 생략 |

- 검증은 envelope 내 고유 `eventKey+eventVersion` 조합만 registry에 질의 (중복 호출 방지)
- registry 자체가 불가용할 경우 → fail-open (유효하다고 간주)

## 저장 의존 계약

| 포트 | Phase | 설명 |
|------|-------|------|
| `transmissionStore` | 1 | 전송 메타데이터 (transmission_id, source, runtime 등) |
| `traceStore` | 1 | trace upsert (traceId, sessionId, 기간, 레코드 수) |
| `sessionStore` | 1 | session upsert (sessionId, actorId, userId) |
| `recordStore` | 1 | record batch insert |
| `recordStreamBroker` | 1 | 실시간 SSE/WebSocket 발행 |
| `debugStore` | 1 | 디버그 저장 (선택) |

## 트랜잭션 경계

`withTraceTransaction`이 설정되면 trace + session + record를 단일 트랜잭션으로 묶는다:

- `TRACE_DATABASE_URL` 설정 시 Drizzle 트랜잭션 사용
- 미설정 시 각 store에 개별 호출 (InMemory 환경)

trace 그룹 단위로 처리: 같은 `trace_id`의 레코드를 모아서 한 트랜잭션으로 저장.
