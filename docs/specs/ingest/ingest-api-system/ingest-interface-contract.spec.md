---
def:
  tier: component
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
sources:
  - packages/core/src/schema/envelope.schema.ts
  - packages/core/src/types/envelope.ts
  - packages/ingest-server/src/app.ts
  - packages/ingest-server/src/routes/ingest.ts
  - packages/ingest-server/src/routes/ingest.test.ts
  - packages/ingest-server/src/app.test.ts
  - packages/ingest-server/src/middleware/rate-limit.ts
  - packages/ingest-server/src/middleware/shutdown.ts
  - packages/ingest-server/src/lib/enrich-address-context.ts
  - packages/ingest-server/src/lib/catalog-validator.ts
  - packages/ingest-server/src/lib/proto-codec.ts
  - packages/codec-proto/src/index.ts
---

# Ingest 인터페이스 계약

## 목적 ^purpose

SDK가 보내는 Transmission Envelope을 수신하는 ingest 엔드포인트의 입력, 응답, 저장 의존 계약을 분리해 정리한다.

## 구성 ^overview

- **POST /v1/ingest** — SDK의 TransmissionEnvelope을 수신하여 Phase 1 저장과 설정별 후속 처리를 거친 뒤 202 응답.
- **Content-Type 자동 감지** — JSON, QAPB(레거시), 진짜 Protobuf, MessagePack 4종 지원.
- **Phase 1 (동기)** — transmission 메타 + trace/session/record 저장 + SSE/WS 발행.
- **검증 모드** — zod schema, catalog fail-open warning, registry strict/warn/off를 분리.
- **관측 저장** — debug/key observation/insights 저장은 선택 포트이며 실패 시 ingest 응답을 막지 않는다.
- **Phase 2 (후속)** — reconstruction + verdict 계산 (BullMQ enqueue 또는 inline 처리).

## 엔드포인트 계약

### POST /v1/ingest

**요청:**

TransmissionEnvelope 형태의 body. `transmissionEnvelopeSchema` (zod)로 검증.

| Content-Type | 처리 |
|:---|:---|
| `application/json` (기본) | JSON.parse |
| `application/x-protobuf` + QAPB magic (0x51415042) | `fromProtoEnvelope` (레거시 QAPB) |
| `application/x-protobuf` (magic 없음) | `@qa-sdk/codec-proto` decodeEnvelope → zod 검증. 손상된 바이트는 `CorruptEnvelope`(400), JSON 재해석은 codec-proto 모듈 로드 실패일 때만 |
| `application/msgpack` | @msgpack/msgpack decode |

**응답 (성공):**

```json
{
  "accepted": true,
  "record_count": 5
}
```

HTTP 202 Accepted. Phase 1 저장이 완료되었고, Phase 2는 설정에 따라 BullMQ에 enqueue되었거나 inline 처리 경로를 통과했음을 의미한다.

**응답 (실패):**

| HTTP | 조건 |
|------|------|
| 400 | envelope schema 검증 실패(`INVALID_INPUT`), registry strict 모드 위반, 손상된 proto(`CorruptEnvelope`) |
| 422 | `SNAPSHOT_GATE_MODE=enforce`에서 snapshot gate 계약 위반 — `error.code`: `CatalogMismatch`·`UnknownCatalogSnapshot`·`UnsupportedCodecVersion`·`UnknownPrefix`·`MigrationRequired` |
| 429 | rate-limit 초과 |
| 503 | shutdown 중 (middleware가 차단) |

## 입력 데이터 흐름

```
SDK → POST /v1/ingest (Envelope)
  → deserializeEnvelope (Content-Type 감지)
  → transmissionEnvelopeSchema.parse (zod 검증)
  → snapshot gate (catalog_snapshot 판정 — off | warn | enforce, 기본 warn)
  → enrichAddressContext (infra_context ← record.address_context 머지)
  → checkAddressHealth (orphan prefix / stale version 경고)
  → validateWithCatalog (catalog 검증 — fail-open warning)
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
| `catalog_snapshot` | (선택) 좌표 주소를 만든 CatalogSnapshot 문맥 — `catalog_id`, `snapshot_version?`, `digest`, `codec_version` |
| `entry_snapshot` | (deprecated) `catalog_snapshot`으로 대체 |

## Snapshot gate (ADR-010)

| 판정 | 조건 | warn | enforce |
|---|---|---|---|
| `ok` | 사용된 prefix@version이 모두 decode 가능하고 주소가 layout 주소 공간 안 | 수락 | 수락 |
| `missing` | `catalog_snapshot` 없음 (구버전 SDK) | 수락 + 경고 1회 | 수락 + 경고 1회 |
| `degraded` | registry 조회 실패·target snapshot 없음 | 수락 + 경고 1회 (fail-open) | 수락 + 경고 1회 (fail-open) |
| `violation` | `resolveDecodeLayout` 또는 `assertAddressInLayout`(`AddressOutOfRange`·`StrideOverflow`)이 `CodecContractError`로 거부 | 수락 + 경고 1회 | **422** |

- target snapshot: registry `GET /catalogs/:id/snapshots/latest` (60s 캐시), 생성 snapshot: `GET /catalogs/:id/snapshots/:digest` (불변이라 영구 캐시). 둘 다 `AbortSignal.timeout(5_000)`
- 생산자: Node SDK는 codegen 생성물의 `CATALOG_SNAPSHOT`, 브라우저 SDK는 `BROWSER_CATALOG_SNAPSHOT`을 설정 `catalogSnapshot`으로 넘긴다
- 설정: `SNAPSHOT_GATE_MODE`, `SNAPSHOT_REGISTRY_URL`(미설정 시 `REGISTRY_URL`)
- 관측: `snapshot_gate_total{result, code}`, `/health/ready`의 `snapshot_registry: ok|degraded`(장애여도 readiness는 유지)

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
| `keyObservationStore` | 1 | key observation 추출/저장 (선택, fail-open) |
| `insightsStore` | 1 이후 | AppHub/Drizzle insights 수집 (선택, fail-open) |

## 트랜잭션 경계

`withTraceTransaction`이 설정되면 trace + session + record를 단일 트랜잭션으로 묶는다:

- `TRACE_DATABASE_URL` 설정 시 Drizzle 트랜잭션 사용
- 미설정 시 각 store에 개별 호출 (InMemory 환경)

trace 그룹 단위로 처리: 같은 `trace_id`의 레코드를 모아서 한 트랜잭션으로 저장.
