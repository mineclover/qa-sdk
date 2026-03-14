# BeaconTransport

> 브라우저 언로드 타이밍에서도 이벤트를 누락하지 않는 전송 구현체.
> `navigator.sendBeacon` 을 우선 시도하고, 미지원/실패 시 `fetch keepalive` 로 fallback.

## 상태

implemented

---

## 인터페이스

```typescript
class BeaconTransport implements Transport {
  constructor(endpoint: string);
  send(envelope: TransmissionEnvelope): Promise<void>;
  flush(): Promise<void>;    // no-op
  shutdown(): Promise<void>; // no-op
}
```

`endpoint`: 전체 URL (`/v1/ingest` 경로 포함). 예: `"http://localhost:3100/v1/ingest"`

---

## `send()` 전송 체인

```
1. navigator.sendBeacon(endpoint, Blob<application/json>)
   └─ 반환값 true  → 완료 (fire-and-forget)
   └─ 반환값 false → fallback (payload > 64KB 등 브라우저 거부)
   └─ API 미존재  → fallback (Node.js, 구형 브라우저)

2. fetch(endpoint, { method: "POST", keepalive: true, body, headers })
   └─ res.ok === true  → 완료
   └─ res.ok === false → throw Error("[BeaconTransport] {status} {statusText}")
   └─ fetch reject    → 그대로 에러 전파 (네트워크 오류 등)
```

### 요청 포맷

| 항목 | 값 |
|---|---|
| Method | POST |
| Content-Type | `application/json` |
| Body (sendBeacon) | `new Blob([jsonString], { type: "application/json" })` |
| Body (fetch) | `JSON.stringify(envelope)` |
| fetch keepalive | `true` |

---

## `sendBeacon` vs `fetch keepalive` 특성 비교

| 특성 | `navigator.sendBeacon` | `fetch keepalive` |
|---|---|---|
| 언로드 후 전송 보장 | 브라우저가 OS 수준에서 보장 | 대부분의 브라우저에서 보장 |
| 응답 접근 | 불가 (fire-and-forget) | 가능 (res.ok 확인) |
| payload 크기 제한 | ~64KB (브라우저별 상이) | 64KB (Chromium 기준) |
| 동기 여부 | 비동기 (브라우저가 큐에 넣음) | 비동기 (Promise) |
| 에러 전파 | 없음 (`false` 반환) | throw 가능 |

---

## 에러 시맨틱

| 상황 | 동작 |
|---|---|
| `sendBeacon` → `true` | 성공. Promise resolve. |
| `sendBeacon` → `false` | fallback으로 진행. |
| `fetch` `res.ok` | 성공. Promise resolve. |
| `fetch` `!res.ok` (4xx/5xx) | `throw Error("[BeaconTransport] {status} {statusText}")` |
| `fetch` network error | fetch reject 그대로 전파. |

**호출자(QaLogger) 처리:**
- `logger.flush()` 명시 호출 → throw 전파 (호출자가 처리)
- 자동 flush (interval / batch) → `onError` 콜백 호출

---

## `flush()` / `shutdown()`

두 메서드 모두 no-op. 즉시 resolve.

BeaconTransport는 버퍼를 자체 보유하지 않는다. 버퍼 관리는 QaLogger가 담당한다.

---

## SSR / 비브라우저 환경

```typescript
if (typeof navigator !== "undefined" && navigator.sendBeacon) {
  // sendBeacon 경로
}
// 없으면 fetch 경로로 fallback
```

Node.js 환경에서는 `navigator` 가 없으므로 `fetch keepalive` 경로로 동작한다.
Node.js의 `fetch` 는 `keepalive` 를 무시하므로, SSR에서 BeaconTransport를 사용하지 않는 것이 원칙.

---

## 제약 조건

- `sendBeacon` 은 `false` 를 반환해도 에러를 throw하지 않는다 — 실패 여부를 알 수 없음.
- `fetch keepalive` 도 브라우저 탭이 이미 닫힌 시점에는 완료를 보장하지 않는 경우가 있다.
- 재시도 로직 없음. 실패 레코드는 QaLogger 버퍼에서 재삽입(QaLogger 책임).
- `Content-Type: application/json` — ingest-server는 이 헤더를 기대함.

---

## 테스트 커버리지

`packages/browser-sdk/src/transport.test.ts`:

- `sendBeacon` 경로 — `navigator.sendBeacon` 호출 + true 반환 시 fetch 미호출
- `sendBeacon` false → fetch fallback 동작
- `sendBeacon` 미지원 환경 → fetch 직접 호출
- fetch 2xx → resolve
- fetch 4xx → throw (상태코드 포함 메시지)
- fetch 5xx → throw
- network error → fetch reject 전파
- `flush()` / `shutdown()` → no-op
