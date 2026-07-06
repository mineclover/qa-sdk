---
def:
  id: platform-chain-system
  tier: system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [structural, entry-point]
  links:
    - target: system-libraries
      type: refines
    - target: platform-core-spec
      type: contains
    - target: platform-codec-spec
      type: contains
    - target: platform-context-spec
      type: contains
    - target: platform-logger-spec
      type: contains
    - target: platform-sdk-spec
      type: contains
    - target: platform-sdk-user-scenarios
      type: contains
    - target: demo-snapshot
      type: contains
    - target: demo-types
      type: contains
    - target: demo-tests
      type: contains
sources:
  - packages/core/src/index.ts
  - packages/core/src/platform/index.ts
  - packages/logger/src/index.ts
  - packages/codec/src/index.ts
  - packages/context/src/index.ts
  - packages/sdk/src/index.ts
  - packages/sdk/src/logger.test.ts
  - packages/sdk/src/dim-wire.test.ts
  - packages/sdk/src/qa-context.test.ts
---

# 플랫폼 의존 체인 — core → logger/codec/context → sdk

## 목적 ^purpose

QA 플랫폼의 핵심 라이브러리 5개가 `@qa-sdk/core`를 루트로 하는 단방향 의존 구조를 형성한다. `@qa-sdk/logger`, `@qa-sdk/codec`, `@qa-sdk/context`는 서로를 직접 끌어오지 않는 보조 레이어이고, `@qa-sdk/sdk`가 이들을 하나의 소비자 facade로 재수출한다.

소스: `packages/core/src/index.ts`, `packages/logger/src/index.ts`, `packages/codec/src/index.ts`, `packages/context/src/index.ts`, `packages/sdk/src/index.ts`

## 정의 ^defines

- 의존 방향 규칙: `core`는 downstream을 import하지 않고, `sdk`가 `core/logger/codec/context`를 조립한다.
- `logger`, `codec`, `context`는 각각 관측 이벤트, dim-wire/typed index, catalog context를 소유한다.
- `ServiceBootConfig`는 서비스 정체성에서 `TransmissionSource`, `TransmissionBuild`, service prefix dim을 파생하는 단일 입력이다.

## 위임 ^delegates

- **platform-core** → Catalog 타입, 런타임 함수, 에러 컨벤션, auth middleware
- **platform-logger** → `QaLogger`, `TraceContext`, transport, masking, debug WebSocket/ingest forwarder
- **platform-codec** → `createDimWireCodec`, `createIndexSDK`
- **platform-context** → `createQaContext`, `createQaContextAsync`, `createCatalogProvider`
- **platform-sdk** → core/logger/codec/context public export surface 통합

## 구성 ^overview

```
@qa-sdk/core (루트 — Catalog 타입 + 런타임)
  ├─ @qa-sdk/logger  (관측 이벤트 + transport)
  ├─ @qa-sdk/codec   (dim-wire + typed index SDK)
  └─ @qa-sdk/context (catalog/service context)
        ↓
@qa-sdk/sdk (통합 facade: core/logger/codec/context 재수출)
```
