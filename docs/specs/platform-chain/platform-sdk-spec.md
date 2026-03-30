---
def:
  id: platform-sdk-spec
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: experience
  svc: sdk
  tags: [entry-point, contract, runtime]
  links:
    - target: platform-chain-system
      type: refines
    - target: platform-core-spec
      type: depends_on
    - target: platform-logger-spec
      type: depends_on
    - target: platform-codec-spec
      type: depends_on
    - target: platform-context-spec
      type: depends_on
    - target: platform-sdk-user-scenarios
      type: refines
---

# @qa-sdk/sdk — 클라이언트 SDK

## 목적 ^purpose

`@qa-sdk/sdk`의 현재 export surface와 책임 경계를 정의한다. 이 패키지는 logger, codec, context, core helper를 재수출하는 통합 진입점이며, 소비처는 내부 패키지 조합 대신 이 패키지를 기준으로 계측을 시작한다.

## 정의 ^defines

- `QaLogger`, `TraceContext`, `HttpTransport`, `NoopTransport` — 이벤트 기록과 전송의 기본 surface
- `createQaContext`, `createQaContextAsync`, `createCatalogProvider` — 좌표 인코딩/해석용 context surface
- `createIndexSDK`, `createDimWireCodec` — typed codec surface
- `newTraceId`, `newSpanId`, `newLogId`, `newQaSessionId`, `now` — 런타임 helper
- `toServiceDims`, `toTransmissionSource`, `toTransmissionBuild` — 서비스 식별자 파생 helper

## 구성 ^overview

- `@qa-sdk/sdk`는 자체 구현 패키지라기보다 `@qa-sdk/logger`, `@qa-sdk/context`, `@qa-sdk/codec`, `@qa-sdk/core`의 통합 export surface다.
- 일반 소비처는 이 패키지 하나만 import하면 logger, context, ID helper를 함께 사용할 수 있다.
- 브라우저 자동 수집은 이 패키지 단독 책임이 아니며, session persistence/autoCapture는 `@qa-sdk/browser`가 맡는다.
- 최소 소비처 reference는 `packages/viteplus-sdk-smoke/src/smoke.ts`, 복사 가능한 Vite bridge template은 `packages/viteplus-sdk-smoke/src/qa-bridge.ts`, 브라우저 facade reference는 `packages/roleplay-web/src/sdk/qa-bridge.ts`, 브라우저 monitor reference는 `packages/browser-sdk/src/monitor.ts`다.

## 소비 ^consumes

- @qa-sdk/core — Catalog, ServiceBootConfig
- @qa-sdk/logger — QaLogger (이벤트 emit)
- @qa-sdk/codec — dim-wire 인코딩
- @qa-sdk/context — QaContext (세션, 카탈로그)

## 관련 소스

- `packages/sdk/src/index.ts` — public export SSOT
- `packages/sdk/README.md` — 설치/초기화/transport/API 사용법
- `packages/viteplus-sdk-smoke/src/qa-bridge.ts` — Vite 앱용 최소 bridge template
- `packages/viteplus-sdk-smoke/src/smoke.ts` — 최소 소비처 reference
- `packages/roleplay-web/src/sdk/qa-bridge.ts` — 앱 facade reference
- `packages/browser-sdk/src/monitor.ts` — 브라우저 운영 reference
- `docs/specs/platform-chain/platform-sdk-user-scenarios.spec.md` — 기대 사용자 시나리오
