---
def:
  id: transmission-spec
  address: def_document:v1:2673
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [tier-infra]
  links:
    - target: record-spec
      type: depends_on
---

# TransmissionEnvelope + TransmissionStore

## 목적 ^purpose

SDK가 전송하는 배치 단위와 수신 메타데이터 감사 저장소.

## 구성 ^overview

- **TransmissionEnvelope**: SDK flush() 시 전송 단위 — transmission_id, owner, source, runtime, build, records 포함
- **TransmissionStore**: insert 단일 메서드 포트 — envelope 메타데이터만 저장 (records는 RecordStore로 분리)
- **감사 목적**: receivedAt(서버 수신 시각)으로 전송 이력 추적, 빈 records 배열도 허용
- **Zod 검증**: transmissionEnvelopeSchema로 ingest-server POST /v1/ingest 요청 body 검증

## 상태

implemented

## TransmissionEnvelope 타입

SDK `flush()` 시 전송되는 단위.

```typescript
interface TransmissionEnvelope {
  transmission_id: string;  // txm_<ULID>
  sent_at: string;          // ISO-8601
  owner: { owner_type: "tenant" | "workspace" | "user" | "agent"; owner_id: string };
  source: { service_name: string; sdk_name: string; sdk_version: string };
  runtime: { platform: string; device_ref?: string; os_version?: string; app_version?: string };
  build: { env: "local" | "dev" | "staging" | "production"; build_ref?: string; release_version?: string };
  records: EventRecord[];
}
```

## TransmissionStore 포트

```typescript
interface TransmissionStore {
  insert(params: TransmissionInsert): Promise<void>;
}
```

## 동작

### insert
- envelope 메타데이터만 저장 (records는 RecordStore로 분리 저장)
- 감사(audit) 및 디버깅 목적
- `receivedAt`은 서버 수신 시각 (DB defaultNow)

## Zod 스키마

`transmissionEnvelopeSchema` — owner, source, runtime, build 각 section 검증 + records 배열 검증.

ingest-server의 `POST /v1/ingest` 에서 요청 body 검증에 사용.

## 제약 조건

- `transmission_id`는 PK
- records가 빈 배열인 envelope도 허용 (no-op)
- owner_type enum: tenant, workspace, user, agent
- build.env enum: local, dev, staging, production
