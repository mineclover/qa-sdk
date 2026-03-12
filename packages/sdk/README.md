# @qa-sdk/sdk

QA 세션 기반 trace 수집 SDK.
브라우저, Node.js, Edge Runtime 등 환경에 부착하여 이벤트를 수집하고 배치 전송한다.

---

## 설치

```bash
pnpm add @qa-sdk/sdk
```

`@qa-sdk/core`는 workspace 의존으로 자동 포함된다.

---

## 기본 구성

```ts
import { QaLogger, HttpTransport } from "@qa-sdk/sdk";

const logger = new QaLogger({
  transport: new HttpTransport({
    endpoint: "https://collector.example.com/v1/ingest",
    headers: { "x-api-key": "..." },
    timeout_ms: 10_000,           // default 10s
  }),

  owner: {
    owner_type: "tenant",         // tenant | workspace | user | agent
    owner_id: "tenant_abc",
  },

  source: {
    service_name: "checkout_web",
    sdk_name: "@qa-sdk/sdk",
    sdk_version: "0.1.0",
  },

  runtime: {
    platform: "browser",          // browser | node | edge | react-native ...
    device_ref: "iPhone 15",      // optional
    os_version: "iOS 18.3",       // optional
    app_version: "2.4.1",         // optional
  },

  build: {
    env: "staging",               // local | dev | staging | production
    build_ref: "abc123",          // optional — git sha, build id 등
    release_version: "2.4.1",     // optional
  },

  // ── 선택 옵션 ──────────────────────────────────────
  maskingRules: [                 // optional — 전역 마스킹 규칙
    { field: "email", mode: "mask" },
    { field: "ssn", mode: "drop" },
  ],
  batchSize: 50,                  // default 50 — 이 개수가 차면 자동 flush
  flushIntervalMs: 5_000,         // default 5000ms — 주기적 flush (0이면 비활성)
});
```

### Config 필드 요약

| 필드 | 필수 | 설명 |
|---|---|---|
| `transport` | O | 전송 계층. `HttpTransport`, `NoopTransport` 또는 커스텀 구현 |
| `owner` | O | 이 transmission의 소유자 (tenant, workspace, user, agent) |
| `source` | O | 서비스/SDK 식별 (service_name, sdk_name, sdk_version) |
| `runtime` | O | 실행 환경 정보 (platform 필수, 나머지 optional) |
| `build` | O | 빌드/배포 정보 (env 필수, 나머지 optional) |
| `maskingRules` | - | 전역 payload 마스킹 규칙 배열 |
| `batchSize` | - | 자동 flush 트리거 레코드 수 (default: 50) |
| `flushIntervalMs` | - | 주기적 flush 간격 ms (default: 5000, 0이면 비활성) |

---

## Trace Context

모든 이벤트는 **trace 단위**로 묶인다.
trace를 시작하면 이후 log/span은 해당 trace에 자동 연결된다.

```ts
// 새 trace 시작
const ctx = logger.startTrace({
  qa_session_id: "qas_01JTEST...",   // optional — QA 세션 식별자
});

// trace_id는 자동 생성되거나, 외부에서 주입 가능
const ctx2 = logger.startTrace({
  trace_id: "trc_01JEXTERNAL...",    // 상위 시스템에서 전파된 trace
  qa_session_id: "qas_01JTEST...",
});
```

외부에서 전파된 context를 직접 설정할 수도 있다.

```ts
import { TraceContext } from "@qa-sdk/sdk";

const propagated = new TraceContext({
  trace_id: "trc_01JUPSTREAM...",
  qa_session_id: "qas_01JTEST...",
});
logger.setContext(propagated);
```

> trace를 시작하지 않고 `log()`/`startSpan()`을 호출하면 자동으로 새 trace가 생성된다.

---

## Log 이벤트 기록

```ts
logger.log({
  event_key: "page_view",
  event_version: "001",
  payload: {
    path: "/checkout",
    referrer: "/cart",
  },
});
```

### log() 파라미터

| 필드 | 필수 | 설명 |
|---|---|---|
| `event_key` | O | Event Registry에 등록된 이벤트 키 |
| `event_version` | O | 이벤트 버전 (3자리, e.g. `"001"`) |
| `payload` | - | 자유 구조 JSON payload |
| `payload_format` | - | default `"json"` |
| `payload_encoding` | - | default `"raw"` |
| `qa_session_id` | - | 레코드 단위 override (없으면 context에서 상속) |

---

## Span (실행 구간) 기록

span은 시작/종료가 있는 실행 구간이다.
`startSpan()`이 반환하는 handle의 `end()`를 호출해야 기록이 완성된다.

```ts
const span = logger.startSpan({
  event_key: "http_request",
  event_version: "001",
  span_name: "POST /api/orders",
  payload: { method: "POST", url: "/api/orders" },
});

// ... 실제 작업 수행 ...

span.end({
  status_code: "ok",              // ok | error | unset
  payload: { status: 201 },       // start payload와 merge됨
});
```

span은 자동으로 **parent-child 관계**를 형성한다.

```ts
const outer = logger.startSpan({
  event_key: "checkout_flow",
  event_version: "001",
  span_name: "checkout",
});

  const inner = logger.startSpan({
    event_key: "payment_process",
    event_version: "001",
    span_name: "payment",
  });
  inner.end({ status_code: "ok" });

outer.end({ status_code: "ok" });
// inner.parent_span_id === outer.span_id
```

---

## Payload Masking

민감정보 보호를 위해 클라이언트 측에서 payload를 마스킹한다.
config의 `maskingRules`로 전역 규칙을 설정한다.

### 마스킹 모드

| 모드 | 동작 | 결과 예시 |
|---|---|---|
| `raw` | 원본 유지 | `"email": "a@b.com"` |
| `mask` | 값 제거, 존재 여부만 보존 | `"email": { "_masked": true, "_present": true }` |
| `drop` | 필드 자체 삭제 | (필드 없음) |
| `hash` | 비가역 해시로 변환 | `"email": "h_3a7f2b01"` |

```ts
const logger = new QaLogger({
  // ...
  maskingRules: [
    { field: "email", mode: "mask" },
    { field: "password", mode: "drop" },
    { field: "user_id", mode: "hash" },
  ],
});

logger.log({
  event_key: "signup",
  event_version: "001",
  payload: {
    email: "user@example.com",
    password: "secret123",
    user_id: "usr_abc",
    plan: "pro",
  },
});

// 전송되는 payload:
// {
//   email: { _masked: true, _present: true },
//   user_id: "h_3a7f2b01",
//   plan: "pro"
// }
// payload_masking_applied: true
// payload_masked_fields: ["email", "password", "user_id"]
```

> 마스킹은 QA 검증 대상이기도 하다 — "값은 저장 안 되지만 필드 존재는 확인 가능" 상태를 Spec에서 검증할 수 있다.

---

## Flush & Shutdown

```ts
// 수동 flush — 버퍼에 있는 레코드를 즉시 전송
await logger.flush();

// shutdown — flush 후 transport 정리, 타이머 해제
await logger.shutdown();
```

자동 flush는 두 조건에서 발생한다:
1. 버퍼가 `batchSize`에 도달
2. `flushIntervalMs` 주기 도달

---

## Transport

### HttpTransport

HTTP POST로 envelope를 JSON 전송한다.

```ts
import { HttpTransport } from "@qa-sdk/sdk";

const transport = new HttpTransport({
  endpoint: "https://collector.example.com/v1/ingest",
  headers: { "x-api-key": "key_..." },
  timeout_ms: 10_000,
});
```

### NoopTransport

전송하지 않고 메모리에 쌓는다. 테스트/dry-run용.

```ts
import { NoopTransport } from "@qa-sdk/sdk";

const transport = new NoopTransport();
// logger 사용 후:
console.log(transport.sent);  // TransmissionEnvelope[]
```

### 커스텀 Transport

`Transport` 인터페이스를 구현하면 된다.

```ts
import type { Transport } from "@qa-sdk/sdk";
import type { TransmissionEnvelope } from "@qa-sdk/core";

class WebSocketTransport implements Transport {
  async send(envelope: TransmissionEnvelope): Promise<void> { /* ... */ }
  async flush(): Promise<void> { /* ... */ }
  async shutdown(): Promise<void> { /* ... */ }
}
```

---

## Transmission Envelope 구조

`flush()` 시 전송되는 단위. SDK가 자동으로 구성한다.

```json
{
  "transmission_id": "txm_01J...",
  "sent_at": "2026-03-12T10:00:00.000Z",
  "owner": { "owner_type": "tenant", "owner_id": "tenant_abc" },
  "source": { "service_name": "checkout_web", "sdk_name": "@qa-sdk/sdk", "sdk_version": "0.1.0" },
  "runtime": { "platform": "browser" },
  "build": { "env": "staging" },
  "records": [
    {
      "log_id": "log_01J...",
      "timestamp": "2026-03-12T10:00:00.123Z",
      "record_kind": "log",
      "trace_id": "trc_01J...",
      "span_id": "spn_01J...",
      "event_key": "page_view",
      "event_version": "001",
      "payload_format": "json",
      "payload_encoding": "raw",
      "payload_masking_applied": false,
      "payload_masked_fields": [],
      "payload": { "path": "/checkout" },
      "qa_session_id": "qas_01J..."
    }
  ]
}
```

---

## QA Session Injection

실서비스 환경에서 테스트 세션을 식별하려면 `qa_session_id`를 주입한다.

```ts
import { newQaSessionId } from "@qa-sdk/sdk";

// 1. 세션 생성
const sessionId = newQaSessionId();  // "qas_01J..."

// 2. trace에 주입
logger.startTrace({ qa_session_id: sessionId });

// 3. 이후 모든 log/span에 자동 전파
logger.log({ event_key: "checkout_start", event_version: "001" });
// → record.qa_session_id === sessionId
```

이 값으로 수집된 trace를 필터링하여 **QA 세션 단위 verdict**를 산출할 수 있다.

---

## ID 체계

| prefix | 생성 함수 | 용도 |
|---|---|---|
| `txm_` | `newTransmissionId()` | Transmission Envelope ID |
| `log_` | `newLogId()` | Event Record ID |
| `trc_` | `newTraceId()` | Trace ID |
| `spn_` | `newSpanId()` | Span ID |
| `qas_` | `newQaSessionId()` | QA Session ID |

모든 ID는 ULID 기반이라 시간순 정렬이 가능하다.
