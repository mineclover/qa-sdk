---
def:
  id: address-context-storage
  address: def_document:v2:342145
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: cli
  tags: [observability, persistence, runtime]
  links:
    - target: apm-schema-system
      type: refines
---

# Address Context 저장 계약

## 목적 ^purpose

`address_context`를 저장 스키마와 SDK 검증 체계에 연결하는 방법을 정리해 ingest와 codegen이 같은 필드 의미를 보도록 만든다.

## 구성 ^overview

- `저장 스키마`: address_context가 EventRecord의 canonical source로 저장되는 구조를 정의한다.
- `스토어 드라이버별 처리`: memory/d1/pg/clickhouse 각 드라이버에서의 address_context 저장 방식을 기술한다.
- `SDK 사용 패턴`: QaLogger에서 address_context가 생성되고 전송되는 흐름을 정리한다.
- `검증 파이프라인`: ingest 수집 시점의 address_context 검증 단계를 명시한다.

## 저장 스키마

address_context는 EventRecord의 보조 필드가 아니라 **좌표 해석의 canonical source**이다. 모든 저장 드라이버는 이 필드를 원본 그대로 보존해야 한다.

```typescript
// core/src/types/record.ts
interface EventRecord {
  address_context?: Record<string, string>;  // key=prefix_id, value="prefix:v:address"
}
```

기존 필드(event_key, trace_id 등)와의 관계는 중복 저장이 아니라 **조회 편의용 projection**으로 본다.

## 스토어 드라이버별 처리

store-factory.ts (STORE_DRIVER 환경변수)가 백엔드를 선택한다:

| 드라이버 | 저장 형태 | 조회 | 구현 위치 |
|----------|-----------|------|-----------|
| memory (기본) | JS Object | 직접 필터 | @qa-sdk/store |
| d1 | TEXT (JSON) | JSON_EXTRACT | d1-record-store.ts |
| pg | JSONB | GIN 인덱스 가능 | drizzle + TRACE_DATABASE_URL |
| clickhouse | Map(String, String) | mapContains | clickhouse-record-store.ts |

D1 store는 4개 core store(Record, Trace, Session, Verdict)를 구현하고, 나머지는 InMemory이다. ClickHouse store는 RecordStore만 구현한다.

TransmissionEnvelope에서 받은 infra_context는 `enrichAddressContext()`에서 머지된 후 record에 반영되므로, 저장 시점에는 이미 최종 머지된 상태이다.

## SDK 사용 패턴

QaLogger (packages/logger)에서 address_context가 생성되고 전송되는 4단계 흐름:

1. **이벤트 생성**: `logger.log({ address_context: { tracking: "tracking:v1:5" } })` — record에 직접 지정
2. **로거 설정**: `QaLoggerConfig.infraContext` — envelope 전체에 적용되는 인프라 기본 주소
3. **Envelope 빌드**: `buildEnvelope(records)` — infraContext가 있으면 envelope.infra_context에 포함
4. **Ingest 수집**: `enrichAddressContext(envelope, records)` — infra_context를 각 record에 머지

```typescript
// logger/src/config.ts — 관련 설정
interface QaLoggerConfig {
  infraContext?: Record<string, string>;   // envelope 전체에 적용
  entrySnapshot?: string;                  // 배포 시점의 entry snapshot ID
}
```

Transport 구현체(HttpTransport, ProtobufTransport 등)는 address_context를 변형하지 않고 envelope 그대로 전송한다.

## 검증 파이프라인

ingest-server에서 수집 시 address_context 검증은 두 단계:

1. **스키마 검증**: Zod `transmissionEnvelopeSchema`로 구조 검증 — `z.record(z.string(), z.string()).optional()`
2. **건전성 검증**: `checkAddressHealth(records, knownPrefixes, latestVersions)` — orphan prefix, stale version 탐지

건전성 검증 결과는 이벤트를 거부하지 않고 경고로 기록한다(fail-open). healthRate가 낮으면 SDK 버전 불일치 또는 catalog 동기화 지연을 의심한다.
