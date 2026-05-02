---
def:
  tier: component
  id: trace-context-spec
  address: def_document:v2:204928
  scope: state
  aspect: app_state
  depth: specification
  lifecycle: approved
  layer: domain
  svc: ingest-server
  tags: [runtime, observability, structural]
  links:
    - target: session-spec
      type: depends_on
---
# TraceContext

## 목적 ^purpose

trace_id, span stack, qa_session_id를 관리하는 런타임 컨텍스트 객체.

## 구성 ^overview

- **TraceContext 클래스**: trace_id(readonly, 자동 생성), qa_session_id(선택적, mutable) 관리
- **Span 스택**: LIFO 구조 — pushSpan(생성+push), popSpan(pop+반환), currentSpanId(빈 스택 시 자동 생성)
- **parentSpanId**: depth < 2이면 undefined(root span), depth >= 2이면 stack[length-2] 반환
- **컨텍스트 전파**: 외부 trace context 주입 시 생성자로 주입 후 logger.setContext() 호출

## 상태

implemented

## 인터페이스

```typescript
class TraceContext {
  readonly trace_id: string;
  qa_session_id?: string;

  constructor(options?: { trace_id?: string; qa_session_id?: string });

  pushSpan(span_id?: string): string;
  popSpan(): string | undefined;

  get currentSpanId(): string;
  get parentSpanId(): string | undefined;
  get depth(): number;
}
```

## 동작

### constructor
- `trace_id` 미지정 시 `newTraceId()` 로 자동 생성
- `qa_session_id`는 선택적 — 주입하면 이후 모든 record에 전파

### pushSpan / popSpan
- LIFO 스택 구조
- `pushSpan()`은 새 span_id 생성 후 스택에 push, 반환
- `popSpan()`은 현재 span을 pop, 반환

### currentSpanId
- 스택 top 반환
- 스택이 비어있으면 자동으로 새 span push 후 반환

### parentSpanId
- 스택 depth < 2 이면 `undefined` (root span)
- depth >= 2 이면 `stack[length - 2]` 반환

## 제약 조건

- trace_id는 생성 후 immutable (readonly)
- qa_session_id는 mutable (외부에서 변경 가능)
- span stack은 QaLogger의 startSpan/end 사이클에 의해 관리됨 — 직접 조작 시 불일치 주의
- 외부 trace context 전파 시 `new TraceContext({ trace_id: "...", qa_session_id: "..." })` 로 생성 후 `logger.setContext()` 호출
