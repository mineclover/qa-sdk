---
def:
  id: browser-monitor-spec
  address: def_document:v1:537
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: deprecated
  layer: domain
  svc: shopping-web
  tags: [tier-frontend]
  links:
    - target: browser-lifecycle-spec
      type: depends_on
    - target: trace-context-spec
      type: depends_on
---

# QaMonitor

## 목적 ^purpose

`@qa-sdk/browser` 패키지의 단일 진입점.
`QaLogger` + `BeaconTransport` + `SessionManager` + `AutoCapture` 를 조합한 브라우저 모니터링 SDK.

## 상태

implemented

## 관련 스펙

| 스펙 | 설명 |
|---|---|
| [lifecycle.spec.md](lifecycle.spec.md) | 상태 다이어그램, 단계별 계약, 표준 사용 패턴 |
| [session.spec.md](session.spec.md) | `getOrCreateSession` / `clearSession` 계약, 저장 스키마, 탭 생명주기 |
| [transport.spec.md](transport.spec.md) | `BeaconTransport` 전송 체인, sendBeacon/fetch 특성 비교 |
| [auto-capture.spec.md](auto-capture.spec.md) | 수집 모드별 계약, 정확한 payload 스키마, cleanup 프로토콜 |

---

## 설계 원칙

- **단일 번들** — 외부 의존성 없이 CDN `<script>` 또는 npm import로 즉시 사용. (ESM + UMD)
- **언로드 안전** — `sendBeacon` 실패 시 `fetch keepalive` fallback. 페이지 닫힘 시 이벤트 누락 없음.
- **탭 세션 지속** — `sessionStorage` 기반. 새로고침 후 동일 세션 유지. 탭 닫힘 시 자동 만료.
- **opt-in 자동 수집** — `autoCapture` 미지정 시 어떤 DOM 이벤트도 수집하지 않음.
- **이벤트 버전 자동 해석** — `event-catalog` 등록 이벤트는 버전 자동 조회. 미등록은 `"001"` 적용.

---

## API

```typescript
class QaMonitor {
  constructor(config: QaMonitorConfig);

  // 상태
  get status(): MonitorStatus;    // "active" | "stopped"
  get isActive(): boolean;        // status === "active"

  // 이벤트
  emit(eventKey: string, payload?: Record<string, unknown>): void;

  // 세션
  getSession(): MonitorSession;
  newSession(): MonitorSession;

  // 전송
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

function createQaMonitor(config: QaMonitorConfig): QaMonitor;
```

---

## Config

```typescript
interface QaMonitorConfig {
  ingestUrl: string;               // 필수. ingest-server 베이스 URL (e.g. "http://localhost:3100")
  scenarioId?: string;             // 지정 시 초기화 직후 session_start 이벤트 emit
  autoCapture?: AutoCaptureConfig; // → auto-capture.spec.md
  storageKey?: string;             // sessionStorage 키 (default: "qa_monitor")
  onError?: (err: Error, context: string) => void;  // 자동 flush 실패 콜백 (default: console.error)
  meta?: {
    serviceName?: string;          // TransmissionSource.service_name (default: "browser")
    env?: string;                  // BuildEnv (default: "production")
  };
}
```

---

## 초기화 순서 (constructor)

1. `getOrCreateSession(storageKey)` — sessionStorage 복원 또는 신규 생성
2. `new BeaconTransport("{ingestUrl}/v1/ingest")` 생성
3. `new QaLogger({ transport, flushIntervalMs: 5_000, ... })` 생성
4. `new TraceContext({ trace_id, qa_session_id })` 생성 → `logger.setContext(ctx)`
5. `scenarioId` 지정 시 `this.emit("session_start", { scenario_id })` 호출
6. `autoCapture` 지정 시 `createAutoCapture(config, emit)` 등록
7. `window.addEventListener("pagehide", unloadHandler)` 등록

반환 즉시 `status === "active"`.

---

## 고정 내부 파라미터

| 파라미터 | 값 | 설명 |
|---|---|---|
| `flushIntervalMs` | `5_000` (ms) | QaLogger 자동 flush 주기 |
| 배치 flush 임계값 | `50` (개) | 버퍼 50개 도달 시 즉시 flush |
| 버퍼 최대값 | `500` (개) | 초과 시 가장 오래된 레코드 drop |
| TransmissionSource.sdk_name | `"@qa-sdk/browser"` | |
| TransmissionSource.sdk_version | `"0.1.0"` | |
| TransmissionSource.platform | `"browser"` | |

---

## 메서드별 동작

### `emit(eventKey, payload?)`

- `status === "stopped"` → `console.warn("[QaMonitor] emit("${eventKey}") called after shutdown — event dropped")` 후 return
- `getCoreEvent(eventKey)` 로 `event-catalog` 조회 → `event_version` 취득 (`padStart(3, "0")`)
- 미등록 이벤트 → `event_version = "001"`
- `logger.log({ event_key, event_version, payload })`

### `getSession()`

- 현재 세션의 복사본 `{ ...this.session }` 반환
- `stopped` 상태에서도 마지막 세션 반환 (정상 동작)

### `newSession()`

- `status === "stopped"` → `console.warn("[QaMonitor] newSession() called after shutdown — ignored")` 후 현재 세션 반환, storage 변경 없음
- `clearSession(storageKey)` + `getOrCreateSession(storageKey)` → 새 세션
- `new TraceContext(...)` 생성 → `logger.setContext(ctx)`
- `this.session` 갱신
- 새 세션 반환

### `flush()`

- `status === "stopped"` → no-op (즉시 반환, HTTP 없음)
- `await logger.flush()` — 실패 시 throw (호출자가 처리)

### `shutdown()`

- `status === "stopped"` → no-op (멱등)
- `this._status = "stopped"` 즉시 설정
- `destroyAutoCapture?.()` — DOM 리스너 제거
- `window.removeEventListener("pagehide", unloadHandler)`
- `await logger.shutdown()` — setInterval 정리 → 남은 버퍼 flush → transport.shutdown()

---

## 오류 처리 요약

| 상황 | 동작 |
|---|---|
| `emit()` after shutdown | `console.warn` + drop |
| `newSession()` after shutdown | `console.warn` + 현재 세션 반환 |
| `flush()` after shutdown | no-op |
| 명시적 `flush()` 실패 | throw |
| 자동 flush(interval/batch) 실패 | `onError` 콜백 (default: `console.error`) |
| `sendBeacon` false | fetch keepalive fallback |
| fetch 4xx/5xx | throw → `onError` 또는 호출자 처리 |

---

## 빌드 출력

| 파일 | 형식 | 용도 |
|---|---|---|
| `dist/qa-monitor.esm.js` | ESM | `import { createQaMonitor } from "@qa-sdk/browser"` |
| `dist/qa-monitor.umd.cjs` | UMD | CDN `<script>` → `window.QaMonitor` |

모든 의존성 (`@qa-sdk/sdk`, `@qa-sdk/core`, `@qa-sdk/event-catalog`) 번들 포함. Vite lib mode.

---

## 사용 예시

```typescript
import { createQaMonitor } from "@qa-sdk/browser";

const monitor = createQaMonitor({
  ingestUrl: "http://localhost:3100",
  scenarioId: "checkout_v1",
  autoCapture: { clicks: true, forms: true, navigation: true },
  meta: { serviceName: "shop-frontend", env: "production" },
});

// 수동 이벤트
monitor.emit("item_added_to_cart", { productId: "p_001", price: 9900 });

// 상태 확인
console.log(monitor.status);    // "active"
console.log(monitor.isActive);  // true

// 세션 정보
const { sessionId, traceId } = monitor.getSession();

// 사용자 로그아웃 시 세션 교체
const fresh = monitor.newSession();

// 명시적 종료
await monitor.shutdown();
```

```html
<!-- CDN -->
<script src="qa-monitor.umd.cjs"></script>
<script>
  const monitor = QaMonitor.createQaMonitor({
    ingestUrl: "https://qa.example.com",
    scenarioId: "onboarding_v2",
  });
</script>
```

---

## 제약 조건

- SSR / Node.js 환경에서는 동작하지 않는다 (`sessionStorage`, `navigator`, `document` 미존재).
- `createQaMonitor()` 는 탭당 1회만 호출한다. 동일 `storageKey` 로 여러 인스턴스를 생성하면 세션을 공유하지만 flush 타이머가 중복 실행된다.
- `shutdown()` 이후 재활성화는 지원하지 않는다. 새 수집이 필요하면 `createQaMonitor()` 를 다시 호출한다.
- `flushIntervalMs` 는 5초로 고정이다. 커스텀 간격이 필요하면 `QaLogger` 를 직접 사용한다.

---

## 테스트 커버리지

| 파일 | 테스트 수 | 내용 |
|---|---|---|
| `monitor.test.ts` | 12 | 세션 관리, emit, newSession, shutdown 기본 동작 |
| `monitor.integration.test.ts` | 15 | 전송 envelope 구조, 버전 해석, 배치, autoCapture 파이프라인, sendBeacon 경로, pagehide flush, storageKey 격리 |
| `monitor.lifecycle.test.ts` | 13 | 상태 전환, 각 메서드 가드, 멱등성 |
