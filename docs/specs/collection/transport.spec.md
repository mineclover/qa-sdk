---
def:
  id: collection-transport-spec
  scope: interface
  aspect: event_contract
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: address-context-spec
      type: depends_on
---

# Transport

## 목적 ^purpose

SDK가 수집 envelope을 외부 수집기로 전달하는 전송 계층의 역할, 공통 인터페이스, 기본 구현 범위를 정의한다.

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
- 응답이 2xx가 아니면 상태 코드를 포함한 에러를 throw (4xx, 5xx 모두 해당)
- fetch 자체가 reject되면 (네트워크 오류 등) 그대로 에러 전파
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
- timeout 초과 시 fetch AbortController로 중단; `send()` 호출 시 AbortSignal이 항상 전달됨
- 에러는 호출자(QaLogger의 자동 flush는 fire-and-forget이므로 무시됨, 수동 flush는 에러 전파)

## 테스트 커버리지

`packages/sdk/src/transport/transport.test.ts`:
- NoopTransport: send/flush/shutdown 기본 동작, 다중 envelope 누적
- HttpTransport: JSON POST 전송, custom headers, 비-2xx throw (4xx/5xx), 네트워크 에러 전파, AbortSignal 전달, flush/shutdown no-op
