# Transport

> SDK의 전송 계층 인터페이스와 구현체.

## 상태

implemented

## 인터페이스

```typescript
interface Transport {
  send(envelope: TransmissionEnvelope): Promise<void>;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}
```

## 구현체

### HttpTransport

HTTP POST로 envelope을 JSON 전송.

```typescript
class HttpTransport implements Transport {
  constructor(options: {
    endpoint: string;
    headers?: Record<string, string>;
    timeout_ms?: number;  // default: 10000
  });
}
```

동작:
- `send()`: `fetch(endpoint, { method: "POST", body: JSON.stringify(envelope), headers })`
- 응답이 2xx가 아니면 에러 (현재 silent fail — 재시도 없음)
- `flush()`, `shutdown()`: no-op

### NoopTransport

전송하지 않고 메모리에 저장. 테스트/dry-run용.

```typescript
class NoopTransport implements Transport {
  sent: TransmissionEnvelope[];
}
```

동작:
- `send()`: `this.sent.push(envelope)`
- `flush()`, `shutdown()`: no-op
- `sent` 배열로 전송된 envelope 검증 가능

## 제약 조건

- Transport 인터페이스만 만족하면 커스텀 구현 가능 (WebSocket, gRPC 등)
- HttpTransport는 재시도/백오프 미구현 (v1 scope 외)
- timeout 초과 시 fetch AbortController로 중단
