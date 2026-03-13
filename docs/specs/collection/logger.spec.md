# QaLogger

> 이벤트 수집의 핵심 진입점. log/span 기록, 배치 버퍼링, 자동/수동 flush.

## 상태

implemented

## 인터페이스

```typescript
class QaLogger {
  constructor(config: QaLoggerConfig);

  // context
  startTrace(options?: { trace_id?: string; qa_session_id?: string }): TraceContext;
  get context(): TraceContext | null;
  setContext(ctx: TraceContext): void;

  // recording
  log(params: LogParams): EventRecord;
  startSpan(params: SpanParams): SpanHandle;

  // flush
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

interface SpanHandle {
  span_id: string;
  end(params?: SpanEndParams): EventRecord;
}
```

## QaLoggerConfig

```typescript
interface QaLoggerConfig {
  transport: Transport;                    // 필수
  owner: TransmissionOwner;               // 필수
  source: TransmissionSource;             // 필수
  runtime: TransmissionRuntime;           // 필수
  build: TransmissionBuild;               // 필수
  maskingRules?: MaskingRule[];            // 전역 마스킹 규칙
  batchSize?: number;                     // default: 50
  flushIntervalMs?: number;               // default: 5000 (0이면 비활성)
}
```

## Recording Params

```typescript
interface LogParams {
  event_key: string;
  event_version: string;
  payload?: Record<string, unknown>;
  payload_format?: PayloadFormat;
  payload_encoding?: PayloadEncoding;
  qa_session_id?: string;
}

interface SpanParams extends LogParams {
  span_name: string;
}

interface SpanEndParams {
  status_code?: SpanStatusCode;
  payload?: Record<string, unknown>;
}
```

### LogParams

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `event_key` | string | - | 기록할 이벤트의 canonical key |
| `event_version` | string | - | 이벤트 버전. 일반적으로 `"001"` 형식 |
| `payload` | `Record<string, unknown>` | - | 선택적 payload 객체 |
| `payload_format` | `PayloadFormat` | `"json"` | payload 직렬화 포맷 descriptor |
| `payload_encoding` | `PayloadEncoding` | `"raw"` | payload 인코딩 descriptor |
| `qa_session_id` | string | active context의 `qa_session_id` | 명시 시 현재 trace context보다 우선 |

### SpanParams

- `SpanParams`는 `LogParams`와 동일한 필드를 가지며 `span_name: string` 이 필수다.
- `span_name`은 생성되는 span record의 `span_name` 필드로 그대로 기록된다.

### SpanHandle.end(params?)

- `status_code`: optional. 생략 시 `"ok"`를 사용한다.
- `payload`: optional. `startSpan()` 시점의 `params.payload`와 shallow merge하며, 동일 키가 있으면 `end()` payload 값이 우선한다.
- `payload_format`, `payload_encoding`, `qa_session_id`는 `startSpan()` 시점의 `SpanParams` 값을 그대로 재사용한다.
- 반환값은 최종 span `EventRecord` 이다.

## 동작

### log()
1. activeContext가 없으면 자동 생성 (새 trace)
2. maskingRules 적용 → payload 변환
3. EventRecord 생성 (record_kind: "log")
4. 버퍼에 추가
5. 버퍼 크기 >= batchSize 이면 자동 flush 트리거

### startSpan()
1. activeContext에 새 span push (parent-child 관계 자동)
2. SpanHandle 반환
3. `handle.end()` 호출 시:
   - context에서 span pop
   - start payload + end payload merge
   - maskingRules 적용
   - EventRecord 생성 (record_kind: "span", start_time, end_time 기록)
   - 버퍼에 추가

### flush()
1. 버퍼가 비어있으면 no-op
2. 버퍼의 모든 record를 splice
3. TransmissionEnvelope 빌드 (config의 owner/source/runtime/build + records)
4. `transport.send(envelope)` 호출

### shutdown()
1. flushTimer 해제
2. 남은 버퍼 flush
3. `transport.shutdown()` 호출

## 제약 조건

- span의 `end()`를 호출하지 않으면 해당 span record는 생성되지 않음 (lost span)
- 자동 flush는 fire-and-forget (`void this.flush()`) — 실패해도 에러 전파 안됨
- flushIntervalMs=0 이면 주기적 flush 비활성 (수동 flush만 가능)
- shutdown 후 log/span 호출은 정의되지 않은 동작
- QaLogger는 브라우저 SDK 전용이 아님 — 백엔드 서비스, 테스트 코드 등 모든 환경에서 QA 이벤트 수집에 사용 가능

## 테스트 커버리지

`packages/sdk/src/logger.test.ts`:
- log/startSpan 기본 동작, batchSize 자동 flush, maskingRules, qa_session_id 오버라이드 등

`packages/ingest-server/src/sdk-to-ingest.e2e.test.ts`:
- QaLogger → HttpTransport → POST /v1/ingest → reconstruction → verdict 전체 파이프라인 E2E 검증
- 7가지 체계적 시나리오: required step pass/fail, optional step warn, payload constraint 통과/실패, 시나리오 외 이벤트, 백엔드 로직 수집
