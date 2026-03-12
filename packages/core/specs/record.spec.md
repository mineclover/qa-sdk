# EventRecord + RecordStore

> SDK가 수집하는 개별 이벤트 레코드의 타입 정의와 저장소 포트.

## 상태

implemented

## EventRecord 타입

SDK가 수집하는 단일 이벤트. `log` 또는 `span` 두 종류.

```typescript
interface EventRecord {
  log_id: string;           // log_<ULID>
  timestamp: string;        // ISO-8601
  record_kind: "log" | "span";

  // trace context
  trace_id: string;         // trc_<ULID>
  span_id: string;          // spn_<ULID>
  parent_span_id?: string;

  // event identity
  event_key: string;        // Registry에 등록된 이벤트 키
  event_version: string;    // 3자리, e.g. "001"

  // span fields (record_kind === "span" 일 때)
  span_name?: string;
  start_time?: string;      // ISO-8601
  end_time?: string;        // ISO-8601
  status_code?: "ok" | "error" | "unset";

  // payload
  payload_format: "json" | "protobuf";
  payload_encoding: "raw" | "gzip" | "br";
  payload_masking_applied: boolean;
  payload_masked_fields: string[];
  payload: unknown;

  // QA session
  qa_session_id?: string;   // qas_<ULID>
}
```

## RecordStore 포트

```typescript
interface RecordStore {
  insertBatch(records: RecordInsert[]): Promise<void>;
  findByTraceId(traceId: string): Promise<StoredRecord[]>;
  findByTraceIdPaginated(traceId: string, params?: RecordPaginationParams): Promise<StoredRecordPage>;
  findBySessionId(sessionId: string): Promise<StoredRecord[]>;
  findBySessionIdPaginated(sessionId: string, params?: RecordPaginationParams): Promise<StoredRecordPage>;
  findByTraceAndEventKey(traceId: string, eventKey: string): Promise<StoredRecord[]>;
}
```

## 동작

### insertBatch
- 여러 레코드를 한 번에 저장
- 동일 `log_id` 중복 삽입 시 adapter에 따라 upsert 또는 에러 (Drizzle: onConflictDoNothing)

### findByTraceIdPaginated / findBySessionIdPaginated
- cursor 기반 pagination (timestamp + logId 복합 커서)
- `limit` 기본값 50, 최대 200
- timestamp 오름차순 정렬
- 응답: `{ items, nextCursor, hasMore }`

### findByTraceAndEventKey
- 특정 trace 내 특정 event_key로 필터링
- engine의 constraint evaluation에서 사용

## Zod 스키마

`eventRecordSchema` — record_kind, payload_format, payload_encoding, span_status_code 에 대한 enum 검증 포함.

## 제약 조건

- `log_id`는 전역 유일 (ULID 보장)
- `record_kind: "span"` 일 때 `span_name`, `start_time`, `end_time` 필수 권장 (현재 optional)
- `payload`는 `z.unknown()`으로 검증 — 자유 구조
- pagination cursor는 base64url 인코딩된 `{ timestamp, logId }` JSON
