# EventRecord + RecordStore

> core package의 canonical event record 구조와 저장/조회 동작.

## 상태

implemented

## Payload enum

```typescript
type PayloadFormat =
  | "json"
  | "rpc"
  | "protobuf"
  | "text"
  | "binary"
  | "stream";

type PayloadEncoding = "raw" | "base64" | "gzip+base64";
```

## EventRecord 타입

SDK가 수집하는 단일 이벤트 레코드. 모든 필드명은 `snake_case`를 사용한다.

```typescript
interface EventRecord {
  log_id: string; // log_<ULID>
  timestamp: string; // ISO-8601 UTC
  record_kind: "log" | "span";

  // trace context
  trace_id: string; // trc_<ULID>
  span_id: string; // spn_<ULID>
  parent_span_id?: string;

  // event identity
  event_key: string;
  event_version: string; // e.g. "001"

  // span-only fields
  span_name?: string;
  start_time?: string; // ISO-8601 UTC
  end_time?: string; // ISO-8601 UTC
  status_code?: "ok" | "error" | "unset";

  // payload descriptor
  payload_format: PayloadFormat;
  payload_encoding: PayloadEncoding;
  payload_masking_applied: boolean;
  payload_masked_fields: string[];
  payload: unknown;

  // session / registry metadata
  qa_session_id?: string; // qas_<ULID>
  _registry_warning?: string;
}
```

## RecordStore 동작

- 레코드는 batch 단위로 저장된다.
- 조회 축은 `trace_id`, `qa_session_id`, `event_key`를 기준으로 제공된다.
- paginated read의 cursor는 `timestamp` + `log_id`를 함께 담는 구조를 사용한다.
- 동일 `log_id` 중복 삽입 처리 방식은 adapter 구현에 위임한다.

## 설계 노트

- `_registry_warning`은 registry strict reject가 아닌 warn mode에서 수집을 계속한 경우에만 포함된다.
- `payload_masked_fields`에는 masking 후 남기는 논리 필드명이 담기며, encoded payload byte range를 기록하지 않는다.
- `payload_format`과 `payload_encoding`은 독립 축이다. 예: `payload_format: "json"` + `payload_encoding: "gzip+base64"`.
- `payload`는 자유 구조를 허용하지만, descriptor 필드(`payload_*`)는 항상 함께 기록한다.
