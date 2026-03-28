---
def:
  id: iframe-protocol-spec
  address: def_document:v2:412812
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: shopping-web
  tags: [tier-frontend]
  links:
    - target: motion-content-glossary
      type: depends_on
---

# iframe 통신 프로토콜

## 목적 ^purpose

viz-web(부모)과 roleplay-web(자식 iframe) 간의 `postMessage` 기반 양방향 통신 프로토콜.

## 구성 ^overview

- **통신 채널**: postMessage는 SSE 파이프라인의 보조 채널로, 즉시 UI 피드백 전용으로 사용한다
- **메시지 방향**: ContextMessage(부모→자식, 시나리오 컨텍스트 전달)와 EventEmittedMessage(자식→부모, 이벤트 발생 알림) 2종
- **보안**: origin 검증으로 cross-origin 메시지를 필터링하며, iframe sandbox에 `allow-scripts allow-same-origin allow-forms` 적용
- **부모 측 API**: `createRoleplayHost(container)` — iframe 생성, 컨텍스트 전송, 이벤트 수신, 토글 UI 제공
- **자식 측 API**: `createChildBridge(vizOrigin)` — 컨텍스트 수신, 이벤트 알림 전송, 비-iframe 환경 안전 처리
- **타이밍**: postMessage(~1ms 즉시 하이라이트) 후 SSE(~50-200ms 정식 그래프 업데이트) 순서로 도착
- **타입 공유 전략**: 메시지 타입 정의를 양쪽 패키지에 각각 유지하며, 공유 패키지로 추출하지 않는다
- **타입 가드**: 구조적 타입 검사(`typeof` + `data.type` 문자열 비교 + 필드 타입 확인)로 메시지를 검증한다

## 상태

implemented

## 설계 원칙

- postMessage는 SSE 파이프라인의 보조 채널이다. 실제 데이터 흐름은 `roleplay-web → HttpTransport → ingest-server → SSE → viz-web`이 정상 경로다.
- postMessage는 SSE 지연 없는 즉시 UI 피드백용으로만 사용한다.
- origin 검증으로 cross-origin 메시지를 필터링한다.
- 메시지 타입은 양쪽 패키지에 동일한 정의를 유지한다 (복사, 공유 패키지 없음).

## 메시지 타입

### ContextMessage (viz-web → roleplay-web)

시나리오 컨텍스트를 자식 iframe에 전달한다.

> 타입 정의: packages/viz-web/src/iframe/message-protocol.ts — ContextMessage
> 타입 정의: packages/roleplay-web/src/iframe/message-protocol.ts — ContextMessage (동일 복사본)

- viz-web에서 사용자가 trace에 연결할 때 전송한다.
- roleplay-web은 이 메시지를 수신하면 `QaBridge.startSession(scenarioId)`를 호출하여 동일 trace 컨텍스트로 이벤트를 발생시킨다.

### EventEmittedMessage (roleplay-web → viz-web)

QA 이벤트 발생 알림을 부모에게 전달한다.

> 타입 정의: packages/viz-web/src/iframe/message-protocol.ts — EventEmittedMessage
> 타입 정의: packages/roleplay-web/src/iframe/message-protocol.ts — EventEmittedMessage (동일 복사본)

- roleplay-web에서 사용자 상호작용 → QA 이벤트 발생 시 동시에 전송한다.
- viz-web은 이 메시지를 수신하면 해당 `event_key` 노드를 즉시 `"active"` 상태로 하이라이트한다.

### 타입 합성

> 타입 정의: packages/viz-web/src/iframe/message-protocol.ts — ParentMessage, ChildMessage
> 타입 정의: packages/roleplay-web/src/iframe/message-protocol.ts — ParentMessage, ChildMessage (동일 복사본)

## 타입 가드

> 함수 정의: packages/viz-web/src/iframe/message-protocol.ts — isChildMessage()
> 함수 정의: packages/roleplay-web/src/iframe/message-protocol.ts — isContextMessage(), isEventEmittedMessage()

- 구조적 타입 검사: `typeof data === "object"` + `data.type` 문자열 비교 + 필드 타입 확인.

## viz-web 측 (roleplay-host.ts)

> 타입 정의: packages/viz-web/src/iframe/roleplay-host.ts — RoleplayHost
> 함수 정의: packages/viz-web/src/iframe/roleplay-host.ts — createRoleplayHost()

### 동작

1. `ROLEPLAY_WEB_URL`을 `src`로 하는 `<iframe>`을 생성한다.
2. iframe sandbox: `allow-scripts allow-same-origin allow-forms`.
3. `sendContext()` — `iframe.contentWindow.postMessage(msg, ROLEPLAY_WEB_URL)`.
4. `onEvent()` — `window.addEventListener("message", handler)`. origin이 `ROLEPLAY_WEB_URL`의 origin과 다르면 무시한다.
5. Collapse/Expand 토글 버튼으로 iframe 영역을 접거나 펼 수 있다.
6. `destroy()` — 이벤트 리스너 해제, DOM 제거.

## roleplay-web 측 (child-bridge.ts)

> 타입 정의: packages/roleplay-web/src/iframe/child-bridge.ts — ChildBridge
> 함수 정의: packages/roleplay-web/src/iframe/child-bridge.ts — createChildBridge()

### 동작

1. `window.addEventListener("message", handler)` — origin이 `vizOrigin`인 `ContextMessage`만 처리한다.
2. `notifyEvent(eventKey)` — `EventEmittedMessage`를 생성하여 `window.parent.postMessage(msg, vizOrigin)` 전송. `window.parent === window`이면 (iframe이 아닌 경우) 전송하지 않는다.
3. `onContext(handler)` — 컨텍스트 핸들러를 등록한다 (단일 핸들러).
4. `destroy()` — 이벤트 리스너 해제, 핸들러 null 처리.
5. timestamp는 `@qa-sdk/core`의 `now()`를 사용한다.

## 데이터 흐름 타이밍

```
[User clicks button in roleplay-web]
  ├── (즉시) postMessage → viz-web: 노드 하이라이트 (~1ms)
  └── (비동기) HttpTransport → ingest-server → SSE → viz-web: 그래프 진행 (~50-200ms)
```

postMessage가 먼저 도착하므로 사용자는 즉각적인 시각 피드백을 받고, SSE를 통한 정식 데이터가 도착하면 그래프가 정확한 상태로 업데이트된다.

## 제약 조건

- 메시지 타입 정의는 양쪽 패키지에 각각 존재한다. 공유 패키지로 추출하지 않는다.
- origin 검증은 URL 문자열 비교로 수행한다.
- iframe sandbox에 `allow-same-origin`이 포함되어야 `import.meta.env` 등 Vite 기능이 정상 동작한다.
- `sendContext()`는 `iframe.contentWindow`가 null이면 (로드 전) 아무 동작도 하지 않는다.
