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
  end(params?: { status_code?: SpanStatusCode; payload?: Record<string, unknown> }): EventRecord;
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
