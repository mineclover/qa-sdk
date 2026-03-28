---
def:
  id: qa-bridge-spec
  address: def_document:v1:3225
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: deprecated
  layer: mediation
  tags: [tier-frontend]
  links:
    - target: api-client-spec
      type: depends_on
    - target: iframe-protocol-spec
      type: depends_on
---

# QA Bridge + Event Emitter

## 목적 ^purpose

roleplay-web에서 사용자 폼 상호작용을 QA 이벤트로 변환하고 ingest-server로 전송하는 SDK 통합 계층.

## 상태

implemented

## 설계 원칙

- `QaBridge`는 `QaLogger` + `HttpTransport`의 Facade로, 브라우저 환경에 맞는 간결한 API를 제공한다.
- `EventEmitter`는 DOM 이벤트를 QA 이벤트로 매핑하며, QaBridge와 ChildBridge를 동시에 호출한다 (ingest 전송 + postMessage 전송).
- event_version은 `@qa-sdk/event-catalog`의 `getCoreEvent()`로 자동 해석한다.

## QaBridge (qa-bridge.ts)

```typescript
interface QaBridge {
  startSession(scenarioId?: string): { traceId: string; sessionId: string };
  emitEvent(eventKey: string, payload?: Record<string, unknown>): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

function createQaBridge(config?: { ingestUrl?: string }): QaBridge;
```

### 내부 구성

```typescript
const transport = new HttpTransport({
  endpoint: `${INGEST_SERVER_URL}/v1/ingest`,
});

const logger = new QaLogger({
  transport,
  owner: { owner_type: "tenant", owner_id: "qa-roleplay" },
  source: {
    service_name: "roleplay-web",
    sdk_name: "@qa-sdk/sdk",
    sdk_version: "0.1.0",
  },
  runtime: {
    platform: "browser",
    os_version: navigator.userAgent,
  },
  build: { env: "local" },
  flushIntervalMs: 3_000,
});
```

### 동작

1. **`startSession(scenarioId?)`**
   - `newQaSessionId()`로 세션 ID 생성
   - `logger.startTrace({ qa_session_id: sessionId })`로 trace 컨텍스트 시작
   - `scenarioId`가 있으면 `"session_start"` 이벤트를 자동 로깅
   - `{ traceId, sessionId }` 반환

2. **`emitEvent(eventKey, payload?)`**
   - `logger.log({ event_key, event_version, payload })` 호출
   - `event_version`은 `resolveVersion(eventKey)`로 결정

3. **`flush()`** / **`shutdown()`** — logger에 위임

### event_version 해석

```typescript
function resolveVersion(eventKey: string): string {
  const def = getCoreEvent(eventKey);
  return def?.event_version ?? "1";
}
```

- `@qa-sdk/event-catalog`에 정의된 core event이면 카탈로그의 버전 사용
- 미등록 이벤트이면 기본값 `"1"` 사용

## EventEmitter (event-emitter.ts)

```typescript
interface EventEmitter {
  attach(container: HTMLElement): void;
  detach(): void;
}

function createEventEmitter(bridge: QaBridge, childBridge: ChildBridge): EventEmitter;
```

### DOM 이벤트 → QA 이벤트 매핑

| DOM 이벤트 | QA event_key | payload |
|---|---|---|
| `click` | `"click"` | `{ target_selector, target_text }` |
| `input` / `change` | `"input_change"` | `{ field_name, field_value }` |
| `submit` | `"form_submit"` | `{ form_id }` |

### 동작

1. **`attach(container)`** — container에 `click`, `input`, `change`, `submit` 이벤트 리스너를 등록한다. `AbortController`를 사용하여 일괄 해제 가능.
2. 각 이벤트 핸들러는:
   - QaBridge로 이벤트 전송 (`bridge.emitEvent()`)
   - ChildBridge로 부모 알림 (`childBridge.notifyEvent()`)
   - UI 이벤트 로그에 항목 추가 (`appendToEventLog()`)
3. **`detach()`** — 모든 `AbortController`를 abort하여 리스너 해제.
4. `submit` 이벤트는 `e.preventDefault()`로 실제 폼 제출을 차단한다.

### target selector 생성

```typescript
function selectorOf(el: Element): string {
  // "tag#id.class1.class2" 형식
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = el.className ? `.${el.className.trim().split(/\s+/).join(".")}` : "";
  return `${tag}${id}${cls}`;
}
```

### 이벤트 로그 UI 표시

`#event-log` 요소에 `prepend()`로 최신 이벤트를 상단에 추가한다. 형식: `HH:mm:ss.SSS | event_key | payload_json`.

## 오케스트레이션 (main.ts에서의 통합)

```
1. createQaBridge() → bridge
2. createChildBridge(VIZ_WEB_ORIGIN) → childBridge
3. createEventEmitter(bridge, childBridge) → eventEmitter

4. childBridge.onContext((ctx) => {
     bridge.startSession(ctx.scenarioId);
   });

5. bridge.emitEvent("page_view", { url, title });  // 초기 페이지 뷰

6. eventEmitter.attach(formPreview);
   // 모델 변경 시: eventEmitter.detach() → eventEmitter.attach(formPreview)

7. window.beforeunload → eventEmitter.detach() + childBridge.destroy() + bridge.shutdown()
```

## 템플릿 렌더링 (template/)

### ResolvedRunSpec 타입

```typescript
interface ResolvedRunSpec {
  scenario_id: string;
  template: string;                   // Handlebars 템플릿 문자열
  variables: Record<string, unknown>; // 템플릿 변수
  events: EventMapping[];             // DOM 이벤트 → QA 이벤트 매핑
}

interface EventMapping {
  selector: string;      // CSS selector
  dom_event: string;     // "click", "submit" 등
  qa_event_key: string;  // QA 이벤트 키
  payload_map?: Record<string, string>;  // DOM → payload 필드 매핑
}
```

### renderTemplate()

```typescript
function renderTemplate(template: string, variables: Record<string, unknown>): string;
```

- `Handlebars.compile(template)(variables)` 실행
- 에러 시 `<div class="template-error">Template error: {message}</div>` 반환
- 에러 메시지는 HTML 이스케이프 처리

## 제약 조건

- `QaLogger`의 `flushIntervalMs`는 3초로 설정한다. 실시간성보다 네트워크 효율을 우선한다.
- `owner_type`은 `"tenant"`를 사용한다 (개발 환경 기본값).
- `EventEmitter`는 폼 프리뷰 컨테이너에 이벤트 위임(delegation)으로 동작한다. 개별 요소에 리스너를 등록하지 않는다.
- `submit` 이벤트는 항상 `preventDefault()`로 차단한다.
- `target_text`는 100자에서 truncate한다.
- `page_view` 이벤트는 앱 초기화 시 1회 자동 발생한다.
