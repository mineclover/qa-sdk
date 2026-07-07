---
def:
  tier: component
  id: qa-bridge-runtime
  address: def_document:v2:412821
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: platform-demo
  tags: [contract, runtime, observability]
  links:
    - target: viz-roleplay-system
      type: refines
sources:
  - packages/roleplay-web/src/sdk/qa-bridge.ts
  - packages/roleplay-web/src/sdk/event-emitter.ts
  - packages/roleplay-web/src/sdk/qa-bridge.test.ts
  - packages/roleplay-web/src/sdk/event-emitter.test.ts
  - packages/roleplay-web/src/iframe/child-bridge.ts
  - packages/roleplay-web/src/main.ts
---

# QA Bridge 런타임

## 목적 ^purpose

roleplay-web의 사용자 폼 상호작용을 QA 이벤트로 변환하고 ingest/iframe 경로에 연결하는 런타임 계약을 정리한다.

## 구성 ^overview

QA Bridge는 `@qa-sdk/sdk`의 `QaLogger`/transport 계층과 `@qa-sdk/browser-codec`의 service overlay를 연결한다. EventEmitter는 preview DOM의 click/input/change/submit 이벤트를 QA 이벤트로 기록하고, 동시에 iframe parent에 즉시 알림을 보낸다.

## 이벤트 변환 경로

```
사용자 preview 상호작용
  │
  ├── click / input / change / submit listener
  │     │
  │     └── EventEmitter.emit()
  │           ├── bridge.emitEvent(eventKey, payload)
  │           ├── childBridge.notifyEvent(eventKey)
  │           └── local event log append
  │
  ├── session context
  │     │
  │     └── childBridge.onContext()
  │           └── bridge.startSession(scenarioId, sessionId)
  │
  └── transport
        └── HttpTransport / NoopTransport / custom Transport
```

## 도메인 액션 정의

roleplay-web EventEmitter는 현재 preview DOM 이벤트를 네 가지 event key로 정규화한다:

| DOM 이벤트 | event_key | payload |
|------------|-----------|---------|
| click | `click` | target selector, text |
| input/change | `input_change` | field name, value |
| submit | `form_submit` | form id |
| error | `ERROR:<event_key>` | error message |

## 서비스 메타데이터

```typescript
service_name: "roleplay-web"
sdk_name: "@qa-sdk/sdk"
owner_id: "qa-roleplay"
```

## Infra Context 통합

serviceConfig가 전달되면 `withServiceOverlay()`와 `browserTrack()`으로 service prefix address_context를 계산한다. service dims가 catalog에 없거나 encode가 실패하면 `onError(err, "infra-context")`를 호출하고 infraContext 없이 계속 동작한다.

## EventEmitter 패턴

폼 컴포넌트와 QA 기록 계층 사이의 결합은 느슨하다:

- preview DOM → EventEmitter listener → QaBridge emit
- QaBridge → `QaLogger` + transport flush
- EventEmitter → ChildBridge notifyEvent로 parent viz-web에 즉시 알림
- 이 구조에서 form-builder renderer는 ingest transport의 존재를 모른다
